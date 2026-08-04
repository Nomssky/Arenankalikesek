-- Tabel dasar. Setelah file ini, jalankan semua file supabase/migrations/001-007
-- secara berurutan; migration 007 menambahkan sistem penginapan, kuota, dan storage privat.
-- Tabel: bookings (untuk booking wisata, toko & persewaan)
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('wisata', 'toko', 'parkir', 'sewa')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,
  event_name TEXT,
  booking_date TEXT,
  time_start TEXT,
  time_end TEXT,
  items JSONB DEFAULT '[]',
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial_refund')),
  payment_method TEXT,
  payment_url TEXT,
  transaction_id TEXT,
  booking_code TEXT,
  assigned_pic TEXT,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel: inventory_rentals (untuk barang persewaan)
CREATE TABLE IF NOT EXISTS inventory_rentals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price_per_unit INTEGER NOT NULL DEFAULT 0,
  price_type TEXT NOT NULL DEFAULT 'per_jam' CHECK (price_type IN ('per_jam', 'per_hari', 'per_malam', 'flat')),
  stock INTEGER NOT NULL DEFAULT 1,
  image TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel: rental_bookings (untuk detail persewaan)
-- item_id menyimpan ID item asli (dari fallback data) — tidak ada FK ke inventory_rentals
CREATE TABLE IF NOT EXISTS rental_bookings (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  item_id TEXT NOT NULL,
  item_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  booking_date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  notes TEXT,
  total_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(type);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_date ON rental_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_item ON rental_bookings(item_id);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_item_name ON rental_bookings(item_name);

-- Trigger auto-update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bookings_updated_at ON bookings;
CREATE TRIGGER trigger_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_inventory_rentals_updated_at ON inventory_rentals;
CREATE TRIGGER trigger_inventory_rentals_updated_at
  BEFORE UPDATE ON inventory_rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger: cek overlap sebelum insert/update rental_bookings (migration 011)
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

-- Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_insert_bookings ON bookings;
DROP POLICY IF EXISTS anon_select_bookings ON bookings;
DROP POLICY IF EXISTS anon_select_inventory ON inventory_rentals;
CREATE POLICY anon_select_inventory ON inventory_rentals FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_select_rentals ON rental_bookings;
CREATE POLICY anon_select_rentals ON rental_bookings FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_insert_rentals ON rental_bookings;

-- Harga publik tidak disimpan ulang di schema ini.
-- Sumber data terpusat: src/data/pricing.ts
