-- 020: Hold mengunci slot. Booking belum dibayar (hold) kini memblokir slot —
-- venue, penginapan, dan kuota Edu Trip — sampai pembayaran dibatalkan/di-expire.
-- Hold tak lagi bisa "menumpuk" pada slot yang sama; baris kedua ditolak saat
-- booking (409), bukan saat pembayaran. Dengan ini state 'conflict' di payment
-- route praktis tak pernah terpicu (hanya race tepi yang perlu penanganan admin).
--
-- 017/019 sebelumnya: overlap trigger hanya memeriksa 'active'. Kini sertakan 'hold'.

CREATE OR REPLACE FUNCTION check_rental_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_new_end TIME;
BEGIN
  -- hold pun mengunci slot; hanya baris batal/selesai yang netral.
  IF NEW.status IN ('cancelled', 'returned') THEN
    RETURN NEW;
  END IF;

  v_new_end := COALESCE(NEW.time_end, NEW.time_start + INTERVAL '1 hour');

  PERFORM pg_advisory_xact_lock(
    hashtext('rental:' || NEW.item_id || ':' || NEW.booking_date::text)
  );

  IF EXISTS (
    SELECT 1
    FROM rental_bookings existing
    WHERE existing.item_id = NEW.item_id
      AND existing.booking_date = NEW.booking_date
      AND existing.status IN ('hold', 'active')
      AND existing.id <> NEW.id
      AND (
        NEW.time_start IS NULL
        OR existing.time_start IS NULL
        OR (
          NEW.time_start < COALESCE(existing.time_end, existing.time_start + INTERVAL '1 hour')
          AND v_new_end > existing.time_start
        )
      )
  ) THEN
    RAISE EXCEPTION 'Item sudah dibooking pada rentang waktu tersebut';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tempat penginapan: hold ikut memblokir rentang tanggal (exclusion constraint).
ALTER TABLE accommodation_bookings DROP CONSTRAINT IF EXISTS accommodation_no_date_overlap;
ALTER TABLE accommodation_bookings
  ADD CONSTRAINT accommodation_no_date_overlap
  EXCLUDE USING gist (
    item_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  ) WHERE (status IN ('hold', 'active'));

-- Kuota Edu-Trip: baris hold (reservasi belum bayar) ikut menghitung kuota;
-- slot dilepas saat hold di-expire oleh expire_stale_booking_holds().
CREATE OR REPLACE FUNCTION reserve_booking(
  p_booking JSONB,
  p_rentals JSONB DEFAULT '[]'::jsonb,
  p_accommodations JSONB DEFAULT '[]'::jsonb,
  p_is_edu_trip BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id TEXT := p_booking->>'id';
  v_booking_date DATE := NULLIF(p_booking->>'booking_date', '')::date;
  v_quota INTEGER;
  v_used INTEGER;
  v_accommodation JSONB;
BEGIN
  PERFORM expire_stale_booking_holds();

  IF v_booking_id IS NULL OR v_booking_id = '' THEN
    RAISE EXCEPTION 'ID booking wajib diisi';
  END IF;

  IF p_is_edu_trip THEN
    IF v_booking_date IS NULL THEN
      RAISE EXCEPTION 'Tanggal Edu Trip wajib diisi';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('edu-trip:' || v_booking_date::text));
    SELECT COALESCE(value_numeric, 2) INTO v_quota
      FROM booking_settings WHERE key = 'edu_trip.daily_quota';
    v_quota := COALESCE(v_quota, 2);
    SELECT count(*) INTO v_used
      FROM edu_trip_reservations r
      WHERE r.booking_date = v_booking_date
        AND r.status IN ('hold', 'active');
    IF v_used >= v_quota THEN
      RAISE EXCEPTION 'Kuota Edu Trip pada tanggal tersebut sudah penuh';
    END IF;
  END IF;

  FOR v_accommodation IN SELECT value FROM jsonb_array_elements(COALESCE(p_accommodations, '[]'::jsonb))
  LOOP
    IF EXISTS (
      SELECT 1 FROM booking_date_blocks d
      WHERE d.active = true
        AND d.item_id = v_accommodation->>'item_id'
        AND daterange(d.start_date, d.end_date, '[)') &&
            daterange((v_accommodation->>'check_in_date')::date, (v_accommodation->>'check_out_date')::date, '[)')
    ) THEN
      RAISE EXCEPTION 'Tanggal penginapan sedang ditutup oleh pengelola';
    END IF;
  END LOOP;

  INSERT INTO bookings (
    id, type, booking_code, customer_name, customer_phone, customer_email,
    customer_address, event_name, booking_date, time_start, time_end, items,
    total_amount, status, payment_status, notes, expires_at, booking_mode,
    check_in_date, check_out_date, nights, guest_count, accommodation_type,
    document_type, document_storage_path, pricing_details
  ) VALUES (
    v_booking_id,
    COALESCE(p_booking->>'type', 'wisata'),
    p_booking->>'booking_code',
    p_booking->>'customer_name',
    p_booking->>'customer_phone',
    NULLIF(p_booking->>'customer_email', ''),
    NULLIF(p_booking->>'customer_address', ''),
    NULLIF(p_booking->>'event_name', ''),
    NULLIF(p_booking->>'booking_date', '')::date,
    NULLIF(p_booking->>'time_start', '')::time,
    NULLIF(p_booking->>'time_end', '')::time,
    COALESCE(p_booking->'items', '[]'::jsonb),
    COALESCE((p_booking->>'total_amount')::integer, 0),
    COALESCE(p_booking->>'status', 'pending'),
    COALESCE(p_booking->>'payment_status', 'unpaid'),
    NULLIF(p_booking->>'notes', ''),
    NULLIF(p_booking->>'expires_at', '')::timestamptz,
    COALESCE(p_booking->>'booking_mode', 'standard'),
    NULLIF(p_booking->>'check_in_date', '')::date,
    NULLIF(p_booking->>'check_out_date', '')::date,
    NULLIF(p_booking->>'nights', '')::integer,
    NULLIF(p_booking->>'guest_count', '')::integer,
    NULLIF(p_booking->>'accommodation_type', ''),
    NULLIF(p_booking->>'document_type', ''),
    NULLIF(p_booking->>'document_storage_path', ''),
    COALESCE(p_booking->'pricing_details', '{}'::jsonb)
  );

  INSERT INTO rental_bookings (
    id, booking_id, item_id, item_name, quantity, booking_date, time_start,
    time_end, start_at, end_at, total_price, status, updated_at
  )
  SELECT id, v_booking_id, item_id, item_name, COALESCE(quantity, 1), booking_date,
    time_start, time_end, start_at, end_at, COALESCE(total_price, 0), 'hold', now()
  FROM jsonb_to_recordset(COALESCE(p_rentals, '[]'::jsonb)) AS x(
    id TEXT, item_id TEXT, item_name TEXT, quantity INTEGER, booking_date DATE,
    time_start TIME, time_end TIME, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
    total_price INTEGER
  );

  INSERT INTO accommodation_bookings (
    id, booking_id, item_id, item_name, accommodation_type, check_in_date,
    check_out_date, nights, guest_count, tent_size, tent_count, tent_option,
    nightly_price, extra_guest_fee, addons, total_price, status, updated_at
  )
  SELECT id, v_booking_id, item_id, item_name, accommodation_type, check_in_date,
    check_out_date, nights, guest_count, tent_size, tent_count, tent_option,
    COALESCE(nightly_price, 0), COALESCE(extra_guest_fee, 0), COALESCE(addons, '[]'::jsonb),
    COALESCE(total_price, 0), 'hold', now()
  FROM jsonb_to_recordset(COALESCE(p_accommodations, '[]'::jsonb)) AS x(
    id TEXT, booking_id TEXT, item_id TEXT, item_name TEXT, accommodation_type TEXT,
    check_in_date DATE, check_out_date DATE, nights INTEGER, guest_count INTEGER,
    tent_size TEXT, tent_count INTEGER, tent_option TEXT, nightly_price INTEGER,
    extra_guest_fee INTEGER, addons JSONB, total_price INTEGER
  );

  IF p_is_edu_trip THEN
    INSERT INTO edu_trip_reservations (id, booking_id, booking_date, status)
      VALUES (gen_random_uuid()::text, v_booking_id, v_booking_date, 'hold');
  END IF;

  RETURN v_booking_id;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Penginapan sudah dibooking pada rentang tanggal tersebut';
END;
$$;