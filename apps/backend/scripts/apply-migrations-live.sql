-- ============================================================
-- Migrasi 010-022 — jalankan SEKALI di dashboard Supabase
-- (SQL editor, supabase.com → project → SQL → New query)
--
-- Sumber asli: supabase/migrations/010..022_*.sql
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

-- ---------- 022: notifikasi email + hygiene index ----------
DROP INDEX IF EXISTS idx_bookings_source_ref;
DROP INDEX IF EXISTS idx_bookings_midtrans_status;
DROP INDEX IF EXISTS idx_bookings_stay_dates;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_available;
DROP INDEX IF EXISTS idx_products_sort_order;
DROP INDEX IF EXISTS idx_products_category_available;
DROP INDEX IF EXISTS idx_tour_packages_category;
DROP INDEX IF EXISTS idx_tour_packages_available;
DROP INDEX IF EXISTS idx_tour_packages_category_available;
DROP INDEX IF EXISTS idx_rental_bookings_item_name;

CREATE INDEX IF NOT EXISTS idx_payments_verified_by ON payments (verified_by);
CREATE INDEX IF NOT EXISTS idx_rental_resource_conflicts_item ON rental_resource_conflicts (conflict_item_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_created_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_paid_at TIMESTAMPTZ;

INSERT INTO booking_settings (key, group_name, label, value_numeric, unit, editable)
VALUES ('email_notification.enabled', 'email', 'Notifikasi Email (konfirmasi ke pelanggan)', 1, '1=aktif, 0=nonaktif', true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  editable = true;

-- ---------- 023: hardening keamanan + rate-limit admin login DB-backed ----------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id_key TEXT PRIMARY KEY,
  failed_count INT NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_admin_login_attempt(p_id_key TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_blocked TIMESTAMPTZ;
BEGIN
  INSERT INTO public.admin_login_attempts (id_key, failed_count, updated_at)
  VALUES (p_id_key, 1, now())
  ON CONFLICT (id_key) DO UPDATE
    SET failed_count = admin_login_attempts.failed_count + 1,
        updated_at = now()
  RETURNING failed_count INTO v_count;

  IF v_count >= 16 THEN
    v_blocked := now() + interval '1 hour';
  ELSIF v_count >= 12 THEN
    v_blocked := now() + interval '30 minutes';
  ELSIF v_count >= 8 THEN
    v_blocked := now() + interval '5 minutes';
  ELSIF v_count >= 5 THEN
    v_blocked := now() + interval '15 seconds';
  ELSE
    v_blocked := NULL;
  END IF;

  UPDATE public.admin_login_attempts
  SET blocked_until = v_blocked
  WHERE id_key = p_id_key;

  RETURN v_blocked;
END;
$$;

REVOKE ALL ON FUNCTION public.record_admin_login_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_login_attempt(TEXT) TO service_role;

-- ---------- 024: produk toko bersumber dari backend (store_visible) ----------
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_visible BOOLEAN NOT NULL DEFAULT false;
UPDATE products SET store_visible = true
WHERE name IN ('Pupuk Kompos', 'Pupuk Cair Organik', 'Gula Aren Murni');

-- ---------- 025: hapus produk toko yang bukan tempatnya (paket makanan & fishing) ----------
DELETE FROM products WHERE category IN ('paket-makanan', 'fishing');
-- 026: Rate-limit pembuatan booking per-IP (DB-backed).
-- Melengkapi MAX_PENDING_PER_PHONE (per nomor) dengan pembatas per-IP agar
-- spam slot-hold lintas nomor teratasi. Pola sama dengan admin_login_attempts:
-- hitungan + window dihitung atomik di DB, bukan Map in-memory per-instance.

CREATE TABLE IF NOT EXISTS public.booking_create_attempts (
  id_key TEXT PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_create_attempts ENABLE ROW LEVEL SECURITY;

-- Atomik: reset window bila sudah lewat, lalu increment. Mengembalikan jumlah
-- percobaan dalam window aktif. Pemanggil (service_role) yang memutuskan batas.
CREATE OR REPLACE FUNCTION public.record_booking_create_attempt(
  p_id_key TEXT,
  p_window_minutes INT DEFAULT 15
)
RETURNS INT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.booking_create_attempts (id_key, attempt_count, window_started_at, updated_at)
  VALUES (p_id_key, 1, now(), now())
  ON CONFLICT (id_key) DO UPDATE
    SET attempt_count = CASE
          WHEN booking_create_attempts.window_started_at <= now() - make_interval(mins => p_window_minutes)
            THEN 1
          ELSE booking_create_attempts.attempt_count + 1
        END,
        window_started_at = CASE
          WHEN booking_create_attempts.window_started_at <= now() - make_interval(mins => p_window_minutes)
            THEN now()
          ELSE booking_create_attempts.window_started_at
        END,
        updated_at = now()
  RETURNING attempt_count INTO v_count;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_booking_create_attempt(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_booking_create_attempt(TEXT, INT) TO service_role;
-- 027: seed add-on homestay ke DB (extra-bed, tambahan-tamu).
-- Sejak catalog.ts tidak lagi menyuntikkan item fallback-only saat DB aktif
-- (DB = sumber daftar tunggal, semuanya diatur lewat admin dashboard), item
-- internal yang MASIH dipakai kode harus ada di tour_packages agar harga
-- add-on homestay tetap tersedia. Idempoten: tidak menimpa bila slug sudah ada.

INSERT INTO public.tour_packages (name, category, price, slug, price_type, available, sort_order, image)
SELECT 'Extra Bed 100 × 220 cm', 'homestay', 25000, 'extra-bed', 'fixed', true, 999, '/images/booking-homestay.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.tour_packages WHERE slug = 'extra-bed');

INSERT INTO public.tour_packages (name, category, price, slug, price_type, available, sort_order, image)
SELECT 'Tambahan Tamu', 'homestay', 10000, 'tambahan-tamu', 'fixed', true, 999, '/images/booking-homestay.jpg'
WHERE NOT EXISTS (SELECT 1 FROM public.tour_packages WHERE slug = 'tambahan-tamu');-- 028: produk brand Sibisa di halaman Toko.
-- 1) Pupuk Kompos diganti nama menjadi 'Pupuk Kompos Sibisa' + foto baru.
-- 2) Tambah produk baru 'Media Tanam Sibisa' (sama seperti pupuk: 25000/karung).
-- Idempoten: rename hanya menyasar nama lama; insert dilewati bila slug sudah ada.

UPDATE public.products
SET name = 'Pupuk Kompos Sibisa',
    image = '/images/pupuk-kompos-sibisa.png',
    store_visible = true,
    updated_at = now()
WHERE name = 'Pupuk Kompos';

INSERT INTO public.products (name, price, category, image, description, unit, available, sort_order, slug, price_type, store_visible)
SELECT 'Media Tanam Sibisa', 25000, 'pupuk', '/images/media-tanam-sibisa.png', 'Media tanam organik', 'karung', true, 0, 'media-tanam-sibisa', 'fixed', true
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE slug = 'media-tanam-sibisa');

-- ---------- 029: sembunyikan item wahana/fishing dari tampilan publik ----------
-- Sebelumnya frontend meng-hardcode id (terapi-ikan, kolam-pancing,
-- sewa-alat-pancing, pelet-umpan) untuk menyembunyikannya di /wisata & /jadwal.
-- Kini keputusan jadi data backend: available=false membuat item tidak dikirim
-- GET /api/tour-packages?available=true (pelet-umpan sudah tidak ada di DB).
-- Idempoten: hanya menyasar baris yang masih available=true.

UPDATE public.tour_packages
SET available = false,
    updated_at = now()
WHERE slug IN ('terapi-ikan', 'kolam-pancing', 'sewa-alat-pancing')
  AND available = true;

-- ---------- 030: satu booking dapat memuat beberapa tipe akomodasi ----------
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_accommodation_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_accommodation_type_check
  CHECK (accommodation_type IS NULL OR accommodation_type IN ('homestay', 'camping', 'glamping', 'mixed'));

-- ---------- 031: satu booking dapat memuat Edu Trip pada beberapa tanggal ----------
ALTER TABLE public.edu_trip_reservations
  DROP CONSTRAINT IF EXISTS edu_trip_reservations_booking_id_key;
CREATE INDEX IF NOT EXISTS idx_edu_trip_reservations_booking_id
  ON public.edu_trip_reservations(booking_id);

CREATE OR REPLACE FUNCTION public.reserve_booking(
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
  v_edu_dates JSONB := p_booking->'edu_trip_dates';
  v_edu_date DATE;
  v_quota INTEGER;
  v_used INTEGER;
  v_accommodation JSONB;
BEGIN
  PERFORM expire_stale_booking_holds();
  IF v_booking_id IS NULL OR v_booking_id = '' THEN RAISE EXCEPTION 'ID booking wajib diisi'; END IF;

  IF p_is_edu_trip THEN
    IF v_edu_dates IS NULL OR jsonb_typeof(v_edu_dates) <> 'array' OR jsonb_array_length(v_edu_dates) = 0 THEN
      IF v_booking_date IS NULL THEN RAISE EXCEPTION 'Tanggal Edu Trip wajib diisi'; END IF;
      v_edu_dates := jsonb_build_array(to_jsonb(v_booking_date::text));
    END IF;
    FOR v_edu_date IN SELECT DISTINCT value::date FROM jsonb_array_elements_text(v_edu_dates) AS dates(value)
    LOOP
      PERFORM pg_advisory_xact_lock(hashtext('edu-trip:' || v_edu_date::text));
      SELECT COALESCE(value_numeric, 2) INTO v_quota FROM booking_settings WHERE key = 'edu_trip.daily_quota';
      v_quota := COALESCE(v_quota, 2);
      SELECT count(*) INTO v_used FROM edu_trip_reservations r
        WHERE r.booking_date = v_edu_date AND r.status IN ('hold', 'active');
      IF v_used >= v_quota THEN RAISE EXCEPTION 'Kuota Edu Trip pada tanggal tersebut sudah penuh'; END IF;
    END LOOP;
  END IF;

  FOR v_accommodation IN SELECT value FROM jsonb_array_elements(COALESCE(p_accommodations, '[]'::jsonb))
  LOOP
    IF EXISTS (
      SELECT 1 FROM booking_date_blocks d
      WHERE d.active = true AND d.item_id = v_accommodation->>'item_id'
        AND daterange(d.start_date, d.end_date, '[)') &&
            daterange((v_accommodation->>'check_in_date')::date, (v_accommodation->>'check_out_date')::date, '[)')
    ) THEN RAISE EXCEPTION 'Tanggal penginapan sedang ditutup oleh pengelola'; END IF;
  END LOOP;

  INSERT INTO bookings (
    id, type, booking_code, customer_name, customer_phone, customer_email,
    customer_address, event_name, booking_date, time_start, time_end, items,
    total_amount, status, payment_status, notes, expires_at, booking_mode,
    check_in_date, check_out_date, nights, guest_count, accommodation_type,
    document_type, document_storage_path, pricing_details
  ) VALUES (
    v_booking_id, COALESCE(p_booking->>'type', 'wisata'), p_booking->>'booking_code',
    p_booking->>'customer_name', p_booking->>'customer_phone', NULLIF(p_booking->>'customer_email', ''),
    NULLIF(p_booking->>'customer_address', ''), NULLIF(p_booking->>'event_name', ''),
    NULLIF(p_booking->>'booking_date', '')::date, NULLIF(p_booking->>'time_start', '')::time,
    NULLIF(p_booking->>'time_end', '')::time, COALESCE(p_booking->'items', '[]'::jsonb),
    COALESCE((p_booking->>'total_amount')::integer, 0), COALESCE(p_booking->>'status', 'pending'),
    COALESCE(p_booking->>'payment_status', 'unpaid'), NULLIF(p_booking->>'notes', ''),
    NULLIF(p_booking->>'expires_at', '')::timestamptz, COALESCE(p_booking->>'booking_mode', 'standard'),
    NULLIF(p_booking->>'check_in_date', '')::date, NULLIF(p_booking->>'check_out_date', '')::date,
    NULLIF(p_booking->>'nights', '')::integer, NULLIF(p_booking->>'guest_count', '')::integer,
    NULLIF(p_booking->>'accommodation_type', ''), NULLIF(p_booking->>'document_type', ''),
    NULLIF(p_booking->>'document_storage_path', ''), COALESCE(p_booking->'pricing_details', '{}'::jsonb)
  );

  INSERT INTO rental_bookings (
    id, booking_id, item_id, item_name, quantity, booking_date, time_start,
    time_end, start_at, end_at, total_price, status, updated_at
  )
  SELECT id, v_booking_id, item_id, item_name, COALESCE(quantity, 1), booking_date,
    time_start, time_end, start_at, end_at, COALESCE(total_price, 0), 'hold', now()
  FROM jsonb_to_recordset(COALESCE(p_rentals, '[]'::jsonb)) AS x(
    id TEXT, item_id TEXT, item_name TEXT, quantity INTEGER, booking_date DATE,
    time_start TIME, time_end TIME, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ, total_price INTEGER
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
    FOR v_edu_date IN SELECT DISTINCT value::date FROM jsonb_array_elements_text(v_edu_dates) AS dates(value)
    LOOP
      INSERT INTO edu_trip_reservations (id, booking_id, booking_date, status)
        VALUES (gen_random_uuid()::text, v_booking_id, v_edu_date, 'hold');
    END LOOP;
  END IF;
  RETURN v_booking_id;
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Penginapan sudah dibooking pada rentang tanggal tersebut';
END;
$$;

-- ---------- 032: pengaman race pembayaran vs kedaluwarsa hold ----------
-- expire_stale_booking_holds jangan membatalkan booking yang sudah lunas
-- (webhook/settlement bisa tiba tepat saat hold expired), dan trigger sync
-- memeriksa kuota Edu Trip untuk SEMUA tanggal booking (multi-edu) dengan
-- menghitung hold+active seperti reserve_booking.

CREATE OR REPLACE FUNCTION public.expire_stale_booking_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE bookings
    SET status = 'cancelled', payment_status = 'unpaid', updated_at = now()
  WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= now()
    AND payment_status NOT IN ('paid', 'refunded');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_booking_resource_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edu_date DATE;
  v_quota INTEGER;
  v_used INTEGER;
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
    ELSIF NEW.status = 'pending' THEN
      UPDATE rental_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
      UPDATE accommodation_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
      UPDATE edu_trip_reservations SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
    ELSIF NEW.status IN ('paid', 'confirmed') THEN
      BEGIN
        FOR v_edu_date IN
          SELECT DISTINCT booking_date FROM edu_trip_reservations
          WHERE booking_id = NEW.id AND status = 'hold'
        LOOP
          PERFORM pg_advisory_xact_lock(hashtext('edu-trip:' || v_edu_date::text));
          SELECT COALESCE(value_numeric, 2) INTO v_quota
            FROM booking_settings WHERE key = 'edu_trip.daily_quota';
          v_quota := COALESCE(v_quota, 2);
          SELECT count(*) INTO v_used
            FROM edu_trip_reservations current_reservation
            WHERE current_reservation.booking_date = v_edu_date
              AND current_reservation.status IN ('hold', 'active')
              AND current_reservation.booking_id <> NEW.id;
          IF v_used >= v_quota THEN
            RAISE EXCEPTION 'Kuota Edu Trip sudah penuh saat pembayaran diterima';
          END IF;
        END LOOP;

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
