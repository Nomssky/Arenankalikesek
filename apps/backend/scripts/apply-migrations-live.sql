-- ============================================================
-- Migrasi 010-021 — jalankan SEKALI di dashboard Supabase
-- (SQL editor, supabase.com → project → SQL → New query)
--
-- Sumber asli: supabase/migrations/010..021_*.sql
-- File ini salinan siap-tempel; jangan jalankan dua kali jika
-- 010-013 sudah pernah dijalankan (ON CONFLICT idempoten, tapi
-- trigger 011/017 akan ditimpa ulang — aman).
-- Setelah dijalankan, salin migrasi baru ke file ini agar selalu sinkron.
-- ============================================================

-- ---------- 010: camping & add-on prices ----------
INSERT INTO booking_settings (key, group_name, label, value_numeric, unit)
VALUES
  ('camping.small_tent_price', 'camping', 'Tenda kecil per malam', 20000, 'rupiah/malam'),
  ('camping.large_tent_price', 'camping', 'Tenda besar per malam', 50000, 'rupiah/malam'),
  ('addon.firewood_price', 'add_on', 'Kayu bakar per paket', 25000, 'rupiah/paket'),
  ('addon.nesting_price', 'add_on', 'Sewa nesting', 50000, 'rupiah/unit'),
  ('addon.camping_chair_price', 'add_on', 'Sewa kursi camping', 10000, 'rupiah/unit')
ON CONFLICT (key) DO UPDATE
SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value_numeric = EXCLUDED.value_numeric,
  unit = EXCLUDED.unit,
  updated_at = now();

-- ---------- 011: rental add-on prices + trigger overlap baru ----------
INSERT INTO booking_settings (key, group_name, label, value_numeric, unit)
VALUES
  ('rental.chair_price', 'rental', 'Sewa kursi', 3000, 'rupiah/unit'),
  ('rental.sound_system_price', 'rental', 'Sewa sound system', 300000, 'rupiah/paket'),
  ('rental.mat_price', 'rental', 'Sewa tikar', 10000, 'rupiah/unit')
ON CONFLICT (key) DO UPDATE
SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value_numeric = EXCLUDED.value_numeric,
  unit = EXCLUDED.unit,
  updated_at = now();

CREATE OR REPLACE FUNCTION check_rental_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_new_end TIME;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Baris tanpa jam mulai dianggap menutup satu hari penuh. Jika jam selesai
  -- lama kosong, perlakukan sebagai satu slot satu jam mulai dari time_start.
  v_new_end := COALESCE(NEW.time_end, NEW.time_start + INTERVAL '1 hour');

  PERFORM pg_advisory_xact_lock(
    hashtext('rental:' || NEW.item_id || ':' || NEW.booking_date::text)
  );

  IF EXISTS (
    SELECT 1
    FROM rental_bookings existing
    WHERE existing.item_id = NEW.item_id
      AND existing.booking_date = NEW.booking_date
      AND existing.status != 'cancelled'
      AND existing.id != NEW.id
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

DROP TRIGGER IF EXISTS trigger_check_rental_overlap ON rental_bookings;
CREATE TRIGGER trigger_check_rental_overlap
  BEFORE INSERT OR UPDATE ON rental_bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_rental_booking_overlap();

-- ---------- 012: sewa tenda per ukuran ----------
INSERT INTO booking_settings (key, group_name, label, value_numeric, unit)
VALUES
  ('camping.small_tent_rental_price', 'camping', 'Sewa tenda kecil per malam', 20000, 'rupiah/tenda/malam'),
  ('camping.large_tent_rental_price', 'camping', 'Sewa tenda besar per malam', 50000, 'rupiah/tenda/malam')
ON CONFLICT (key) DO UPDATE
SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value_numeric = EXCLUDED.value_numeric,
  unit = EXCLUDED.unit,
  updated_at = now();

-- ---------- 013: kategori venue ('ruangan' → skema baru) ----------
UPDATE inventory_rentals
SET category = CASE
  WHEN id IN ('aula-dalam', 'aula-full', 'aula-sungai', 'aula-teras', 'joglo')
    THEN 'tempat-pertemuan'
  ELSE 'area-kegiatan' -- gazebo-atas, gazebo-bawah, panggung, pawon
END
WHERE category = 'ruangan';

-- ---------- 014: revoke RPC anon yang tidak dipakai ----------
REVOKE ALL ON FUNCTION public.create_rental_booking(text, integer, timestamptz, timestamptz, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_rental_availability(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_booking_resource_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_rental_booking(text, integer, timestamptz, timestamptz, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rental_availability(text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_booking_resource_status() TO service_role;

-- ---------- 015: hapus check payment_method ad-hoc ----------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

-- ---------- 016: katalog harga DB (slug/price_type/rates) ----------
ALTER TABLE tour_packages
  ADD COLUMN slug text,
  ADD COLUMN price_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN rates jsonb;

ALTER TABLE products
  ADD COLUMN slug text,
  ADD COLUMN price_type text NOT NULL DEFAULT 'fixed';

CREATE UNIQUE INDEX tour_packages_slug_key ON tour_packages (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX products_slug_key ON products (slug) WHERE slug IS NOT NULL;

-- ---------- 017: payment-hold (booking pending tidak memblokir slot) ----------
ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_status_check;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_status_check
  CHECK (status IN ('hold', 'active', 'returned', 'cancelled'));

ALTER TABLE accommodation_bookings DROP CONSTRAINT IF EXISTS accommodation_bookings_status_check;
ALTER TABLE accommodation_bookings ADD CONSTRAINT accommodation_bookings_status_check
  CHECK (status IN ('hold', 'active', 'cancelled'));

ALTER TABLE edu_trip_reservations DROP CONSTRAINT IF EXISTS edu_trip_reservations_status_check;
ALTER TABLE edu_trip_reservations ADD CONSTRAINT edu_trip_reservations_status_check
  CHECK (status IN ('hold', 'active', 'cancelled'));

UPDATE rental_bookings r
SET status = 'hold', updated_at = now()
FROM bookings b
WHERE b.id = r.booking_id
  AND b.payment_status <> 'paid'
  AND b.status <> 'cancelled'
  AND r.status = 'active';

UPDATE accommodation_bookings a
SET status = 'hold', updated_at = now()
FROM bookings b
WHERE b.id = a.booking_id
  AND b.payment_status <> 'paid'
  AND b.status <> 'cancelled'
  AND a.status = 'active';

UPDATE edu_trip_reservations e
SET status = 'hold', updated_at = now()
FROM bookings b
WHERE b.id = e.booking_id
  AND b.payment_status <> 'paid'
  AND b.status <> 'cancelled'
  AND e.status = 'active';

ALTER TABLE accommodation_bookings DROP CONSTRAINT IF EXISTS accommodation_no_date_overlap;
ALTER TABLE accommodation_bookings
  ADD CONSTRAINT accommodation_no_date_overlap
  EXCLUDE USING gist (
    item_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  ) WHERE (status = 'active');

DROP INDEX IF EXISTS idx_edu_trip_reservations_date;
CREATE INDEX idx_edu_trip_reservations_date
  ON edu_trip_reservations(booking_date) WHERE status = 'active';

CREATE OR REPLACE FUNCTION sync_booking_resource_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.status = 'cancelled' THEN
      UPDATE rental_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'returned';
      UPDATE accommodation_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
      UPDATE edu_trip_reservations SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
    ELSIF NEW.payment_status IN ('refunded', 'partial_refund') THEN
      NULL;
    ELSIF NEW.status = 'pending' OR NEW.payment_status <> 'paid' THEN
      UPDATE rental_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
      UPDATE accommodation_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
      UPDATE edu_trip_reservations SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
    ELSIF NEW.status IN ('paid', 'confirmed') AND NEW.payment_status = 'paid' THEN
      BEGIN
        IF EXISTS (
          SELECT 1 FROM edu_trip_reservations
          WHERE booking_id = NEW.id AND status = 'hold'
        ) THEN
          PERFORM pg_advisory_xact_lock(
            hashtext('edu-trip:' || (
              SELECT booking_date::text FROM edu_trip_reservations WHERE booking_id = NEW.id LIMIT 1
            ))
          );
          IF (
            SELECT count(*) FROM edu_trip_reservations current_reservation
            WHERE current_reservation.booking_date = (
              SELECT booking_date FROM edu_trip_reservations WHERE booking_id = NEW.id LIMIT 1
            )
              AND current_reservation.status = 'active'
              AND current_reservation.booking_id <> NEW.id
          ) >= COALESCE((
            SELECT value_numeric::integer FROM booking_settings
            WHERE key = 'edu_trip.daily_quota'
          ), 2) THEN
            RAISE EXCEPTION 'Kuota Edu Trip sudah penuh saat pembayaran diterima';
          END IF;
        END IF;

        UPDATE rental_bookings SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
        UPDATE accommodation_bookings SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status <> 'cancelled';
        UPDATE edu_trip_reservations SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status <> 'cancelled';
      EXCEPTION WHEN OTHERS THEN
        UPDATE bookings
        SET notes = concat_ws(E'\n', NULLIF(notes, ''),
          '[KONFLIK JADWAL SETELAH PEMBAYARAN] Perlu penanganan admin.'),
          updated_at = now()
        WHERE id = NEW.id
          AND COALESCE(notes, '') NOT LIKE '%[KONFLIK JADWAL SETELAH PEMBAYARAN]%';
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_resource_status ON bookings;
DROP TRIGGER IF EXISTS trigger_sync_booking_resource_status ON bookings;
CREATE TRIGGER trigger_sync_booking_resource_status
  AFTER UPDATE OF status, payment_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION sync_booking_resource_status();

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
      JOIN bookings b ON b.id = r.booking_id
      WHERE r.booking_date = v_booking_date
        AND r.status = 'active'
        AND b.payment_status = 'paid'
        AND b.status IN ('paid', 'confirmed');
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
    id TEXT, item_id TEXT, item_name TEXT, accommodation_type TEXT,
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

CREATE OR REPLACE FUNCTION check_rental_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_new_end TIME;
BEGIN
  IF NEW.status <> 'active' THEN
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
      AND existing.status = 'active'
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

-- ---------- 018: kolom status teknis Midtrans ----------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS midtrans_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_midtrans_status
  ON bookings(midtrans_status) WHERE midtrans_status IS NOT NULL;

-- ---------- 019: hold hanya utk pending; confirmed (impor SPR) tetap active ----------
CREATE OR REPLACE FUNCTION sync_booking_resource_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.status = 'cancelled' THEN
      UPDATE rental_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'returned';
      UPDATE accommodation_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
      UPDATE edu_trip_reservations SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
    ELSIF NEW.payment_status IN ('refunded', 'partial_refund') THEN
      -- Refund ditangani admin sesuai aturan pembatalan; jangan melepas jadwal otomatis.
      NULL;
    ELSIF NEW.status = 'pending' THEN
      -- Online belum bayar: hold, tidak memblokir slot & tidak tampil di jadwal.
      UPDATE rental_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
      UPDATE accommodation_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
      UPDATE edu_trip_reservations SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
    ELSIF NEW.status IN ('paid', 'confirmed') THEN
      -- Dikonfirmasi pengelola/bayar lunas: aktif, tampil & memblokir slot.
      BEGIN
        IF EXISTS (
          SELECT 1 FROM edu_trip_reservations
          WHERE booking_id = NEW.id AND status = 'hold'
        ) THEN
          PERFORM pg_advisory_xact_lock(
            hashtext('edu-trip:' || (
              SELECT booking_date::text FROM edu_trip_reservations WHERE booking_id = NEW.id LIMIT 1
            ))
          );
          IF (
            SELECT count(*) FROM edu_trip_reservations current_reservation
            WHERE current_reservation.booking_date = (
              SELECT booking_date FROM edu_trip_reservations WHERE booking_id = NEW.id LIMIT 1
            )
              AND current_reservation.status = 'active'
              AND current_reservation.booking_id <> NEW.id
          ) >= COALESCE((
            SELECT value_numeric::integer FROM booking_settings
            WHERE key = 'edu_trip.daily_quota'
          ), 2) THEN
            RAISE EXCEPTION 'Kuota Edu Trip sudah penuh saat pembayaran diterima';
          END IF;
        END IF;

        UPDATE rental_bookings SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
        UPDATE accommodation_bookings SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status <> 'cancelled';
        UPDATE edu_trip_reservations SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status <> 'cancelled';
      EXCEPTION WHEN OTHERS THEN
        UPDATE bookings
        SET notes = concat_ws(E'\n', NULLIF(notes, ''),
          '[KONFLIK JADWAL SETELAH PEMBAYARAN] Perlu penanganan admin.'),
          updated_at = now()
        WHERE id = NEW.id
          AND COALESCE(notes, '') NOT LIKE '%[KONFLIK JADWAL SETELAH PEMBAYARAN]%';
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-aktifkan resource milik booking confirmed yang terlanjur di-hold migrasi 017.
UPDATE rental_bookings r
SET status = 'active', updated_at = now()
FROM bookings b
WHERE b.id = r.booking_id
  AND b.status = 'confirmed'
  AND r.status = 'hold';

UPDATE accommodation_bookings a
SET status = 'active', updated_at = now()
FROM bookings b
WHERE b.id = a.booking_id
  AND b.status = 'confirmed'
  AND a.status = 'hold';

UPDATE edu_trip_reservations e
SET status = 'active', updated_at = now()
FROM bookings b
WHERE b.id = e.booking_id
  AND b.status = 'confirmed'
  AND e.status = 'hold';
-- ---------- 020: hold mengunci slot (venue/penginapan/edu) ----------
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
-- ---------- 021: hardening search_path trigger overlap ----------
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
$$ LANGUAGE plpgsql
SET search_path = public;
