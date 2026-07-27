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
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_method TEXT,
  payment_url TEXT,
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
CREATE TABLE IF NOT EXISTS rental_bookings (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings(id),
  item_id TEXT REFERENCES inventory_rentals(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  booking_date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  total_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(type);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_date ON rental_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_rental_bookings_item ON rental_bookings(item_id);

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

-- Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_insert_bookings ON bookings;
CREATE POLICY anon_insert_bookings ON bookings FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS anon_select_bookings ON bookings;
CREATE POLICY anon_select_bookings ON bookings FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_select_inventory ON inventory_rentals;
CREATE POLICY anon_select_inventory ON inventory_rentals FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_select_rentals ON rental_bookings;
CREATE POLICY anon_select_rentals ON rental_bookings FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS anon_insert_rentals ON rental_bookings;
CREATE POLICY anon_insert_rentals ON rental_bookings FOR INSERT TO anon WITH CHECK (true);

-- Seed data untuk inventory_rentals
INSERT INTO inventory_rentals (id, name, description, category, price_per_unit, price_type, stock) VALUES
  ('aula-dalam', 'Aula Dalam', 'Ruangan aula di dalam gedung', 'ruangan', 75000, 'per_jam', 1),
  ('aula-teras', 'Aula Teras', 'Ruangan aula di teras', 'ruangan', 75000, 'per_jam', 1),
  ('aula-full', 'Aula Full', 'Paket aula lengkap dalam + teras', 'ruangan', 100000, 'per_jam', 1),
  ('aula-sungai', 'Aula Sungai', 'Aula dengan pemandangan sungai', 'ruangan', 100000, 'per_jam', 1),
  ('panggung', 'Panggung', 'Panggung untuk acara', 'ruangan', 75000, 'per_jam', 1),
  ('gazebo-bawah', 'Gazebo Bawah', 'Gazebo area bawah', 'ruangan', 30000, 'per_jam', 3),
  ('gazebo-atas', 'Gazebo Atas', 'Gazebo area atas', 'ruangan', 30000, 'per_jam', 3),
  ('joglo', 'Joglo', 'Ruangan joglo tradisional', 'ruangan', 100000, 'per_jam', 1),
  ('pawon', 'Pawon', 'Dapur tradisional', 'ruangan', 50000, 'per_jam', 1),
  ('homestay-1', 'Homestay Aren 1', 'Kapasitas 2 orang', 'homestay', 200000, 'per_malam', 1),
  ('homestay-2', 'Homestay Aren 2', 'Kapasitas 2 orang', 'homestay', 200000, 'per_malam', 1),
  ('homestay-3', 'Homestay Aren 3', 'Kapasitas 4 orang', 'homestay', 375000, 'per_malam', 1),
  ('homestay-4', 'Homestay Aren 4', 'Kapasitas 4 orang', 'homestay', 450000, 'per_malam', 1),
  ('kapling-tenda', 'Kapling Tenda', 'Lahan untuk mendirikan tenda', 'camping', 25000, 'per_malam', 10),
  ('tenda-4', 'Tenda 4 Orang', 'Tenda kapasitas 4 orang', 'camping', 60000, 'per_malam', 5),
  ('sewa-alat-pancing', 'Sewa Alat Pancing', 'Set alat pancing lengkap', 'fishing', 5000, 'per_jam', 10)
ON CONFLICT (id) DO NOTHING;
