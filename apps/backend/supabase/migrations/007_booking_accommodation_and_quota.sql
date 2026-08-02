-- ============================================================
-- Migration 007: booking penginapan/camping, kuota Edu Trip,
-- konfigurasi harga, dan dokumen identitas privat.
-- Aman dijalankan berulang (idempotent).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_mode TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_out_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nights INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_count INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accommodation_type TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_storage_path TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_details JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_booking_mode_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_booking_mode_check
      CHECK (booking_mode IN ('standard', 'stay', 'edu_trip'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_stay_dates_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_stay_dates_check
      CHECK (check_in_date IS NULL OR (check_out_date IS NOT NULL AND check_out_date > check_in_date));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_nights_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_nights_check CHECK (nights IS NULL OR nights >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_guest_count_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_guest_count_check CHECK (guest_count IS NULL OR guest_count >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_accommodation_type_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_accommodation_type_check
      CHECK (accommodation_type IS NULL OR accommodation_type IN ('homestay', 'camping', 'glamping'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_document_type_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('ktp', 'kk', 'buku_nikah'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_stay_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_mode ON bookings(booking_mode);

CREATE TABLE IF NOT EXISTS booking_settings (
  key TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  label TEXT NOT NULL,
  value_numeric INTEGER,
  unit TEXT NOT NULL DEFAULT '',
  editable BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO booking_settings (key, group_name, label, value_numeric, unit) VALUES
  ('camping.small_tent_price', 'camping', 'Tenda kecil per malam', 20000, 'rupiah/malam'),
  ('camping.large_tent_price', 'camping', 'Tenda besar per malam', 50000, 'rupiah/malam'),
  ('camping.tent_rental_price', 'camping', 'Sewa tenda per malam', NULL, 'rupiah/malam'),
  ('camping.glamping_base_price', 'camping', 'Harga dasar glamping per malam', NULL, 'rupiah/malam'),
  ('addon.firewood_price', 'add_on', 'Kayu bakar per paket', 25000, 'rupiah/paket'),
  ('addon.nesting_price', 'add_on', 'Sewa nesting', NULL, 'rupiah'),
  ('addon.camping_chair_price', 'add_on', 'Sewa kursi camping', NULL, 'rupiah/unit'),
  ('homestay.aren_1.base_capacity', 'homestay', 'Kapasitas dasar Aren 1', 5, 'orang'),
  ('homestay.aren_2.base_capacity', 'homestay', 'Kapasitas dasar Aren 2', 5, 'orang'),
  ('homestay.aren_1.extra_guest_fee', 'homestay', 'Biaya tamu tambahan Aren 1', 10000, 'rupiah/orang/malam'),
  ('homestay.aren_2.extra_guest_fee', 'homestay', 'Biaya tamu tambahan Aren 2', 10000, 'rupiah/orang/malam'),
  ('edu_trip.daily_quota', 'edu_trip', 'Kuota grup Edu Trip per hari', 2, 'grup/hari')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS accommodation_bookings (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  accommodation_type TEXT NOT NULL CHECK (accommodation_type IN ('homestay', 'camping', 'glamping')),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 1),
  guest_count INTEGER NOT NULL CHECK (guest_count >= 1),
  tent_size TEXT CHECK (tent_size IS NULL OR tent_size IN ('small', 'large')),
  tent_count INTEGER CHECK (tent_count IS NULL OR tent_count >= 1),
  tent_option TEXT CHECK (tent_option IS NULL OR tent_option IN ('own', 'rent')),
  nightly_price INTEGER NOT NULL DEFAULT 0 CHECK (nightly_price >= 0),
  extra_guest_fee INTEGER NOT NULL DEFAULT 0 CHECK (extra_guest_fee >= 0),
  addons JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price INTEGER NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accommodation_booking_dates_check CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_accommodation_item_dates
  ON accommodation_bookings(item_id, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_accommodation_booking_id ON accommodation_bookings(booking_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accommodation_no_date_overlap') THEN
    ALTER TABLE accommodation_bookings
      ADD CONSTRAINT accommodation_no_date_overlap
      EXCLUDE USING gist (
        item_id WITH =,
        daterange(check_in_date, check_out_date, '[)') WITH &&
      ) WHERE (status = 'active');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS booking_date_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  item_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_date_blocks_dates_check CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_date_blocks_item_dates
  ON booking_date_blocks(item_id, start_date, end_date) WHERE active = true;

-- Tanggal libur ditetapkan admin agar tarif Holiday tidak ditebak oleh aplikasi.
CREATE TABLE IF NOT EXISTS booking_holiday_dates (
  holiday_date DATE PRIMARY KEY,
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_holiday_dates_active
  ON booking_holiday_dates(holiday_date) WHERE active = true;

CREATE TABLE IF NOT EXISTS edu_trip_reservations (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edu_trip_reservations_date
  ON edu_trip_reservations(booking_date) WHERE status = 'active';

CREATE OR REPLACE FUNCTION expire_stale_booking_holds()
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
  WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION sync_booking_resource_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' THEN
      UPDATE rental_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'returned';
      UPDATE accommodation_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
      UPDATE edu_trip_reservations SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
    ELSIF NEW.status IN ('pending', 'paid', 'confirmed') THEN
      UPDATE accommodation_bookings SET status = 'active', updated_at = now()
        WHERE booking_id = NEW.id;
      UPDATE edu_trip_reservations SET status = 'active', updated_at = now()
        WHERE booking_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_booking_resource_status ON bookings;
CREATE TRIGGER trigger_sync_booking_resource_status
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION sync_booking_resource_status();

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
        AND b.status IN ('pending', 'paid', 'confirmed')
        AND (b.status <> 'pending' OR b.expires_at IS NULL OR b.expires_at > now());
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
    time_start, time_end, start_at, end_at, COALESCE(total_price, 0), 'active', now()
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
    COALESCE(total_price, 0), 'active', now()
  FROM jsonb_to_recordset(COALESCE(p_accommodations, '[]'::jsonb)) AS x(
    id TEXT, item_id TEXT, item_name TEXT, accommodation_type TEXT,
    check_in_date DATE, check_out_date DATE, nights INTEGER, guest_count INTEGER,
    tent_size TEXT, tent_count INTEGER, tent_option TEXT, nightly_price INTEGER,
    extra_guest_fee INTEGER, addons JSONB, total_price INTEGER
  );

  IF p_is_edu_trip THEN
    INSERT INTO edu_trip_reservations (id, booking_id, booking_date, status)
      VALUES (gen_random_uuid()::text, v_booking_id, v_booking_date, 'active');
  END IF;

  RETURN v_booking_id;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Penginapan sudah dibooking pada rentang tanggal tersebut';
END;
$$;

ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_date_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_holiday_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_trip_reservations ENABLE ROW LEVEL SECURITY;

-- Kolom dokumen tidak boleh dapat dibaca langsung oleh pengguna anonim.
DROP POLICY IF EXISTS anon_select_bookings ON bookings;

REVOKE ALL ON FUNCTION reserve_booking(JSONB, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_booking(JSONB, JSONB, JSONB, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION expire_stale_booking_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_booking_holds() TO service_role;

-- Bucket privat: akses aplikasi hanya melalui service role dan signed URL admin.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('booking-documents', 'booking-documents', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Pastikan tidak ada policy publik dengan nama yang pernah dipakai aplikasi.
DROP POLICY IF EXISTS "Public read booking documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload booking documents" ON storage.objects;
