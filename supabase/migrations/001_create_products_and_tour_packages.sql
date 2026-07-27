-- ============================================================
-- Migration: Create products + tour_packages tables
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PRODUCTS (untuk halaman Toko)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  category TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TOUR PACKAGES (untuk halaman Wisata + Booking Wisata)
CREATE TABLE IF NOT EXISTS tour_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  max_price INTEGER,
  capacity TEXT,
  note TEXT,
  image TEXT DEFAULT '',
  available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (optional, open for now via service_role)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_packages ENABLE ROW LEVEL SECURITY;

-- Allow all operations via service_role / anon (public read)
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read tour_packages" ON tour_packages FOR SELECT USING (true);

-- Allow insert/update/delete only for service_role (handled by API)
CREATE POLICY "Service write products" ON products FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Service write tour_packages" ON tour_packages FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- SEED DATA — Products
-- ============================================================
INSERT INTO products (name, price, category, image, description, unit, sort_order) VALUES
  ('Paket Makan 1', 8000, 'paket-makanan', '/images/playlist-poster.jpg', 'Gudeg + Gorengan', 'paket', 1),
  ('Paket Makan 2', 9000, 'paket-makanan', '/images/village-tradition.jpg', 'Soto + Gorengan', 'paket', 2),
  ('Paket Makan 3', 12000, 'paket-makanan', '/images/playlist-poster.jpg', 'Nasi + Gudeg + Telur + Ayam Kampung + Kerupuk', 'paket', 3),
  ('Paket Makan 4', 15000, 'paket-makanan', '/images/village-tradition.jpg', 'Nasi + Ayam Goreng + Sambal + Lalapan', 'paket', 4),
  ('Paket Makan 5', 15000, 'paket-makanan', '/images/playlist-poster.jpg', 'Nasi + Ayam Geprek', 'paket', 5),
  ('Paket Makan 6', 17000, 'paket-makanan', '/images/village-tradition.jpg', 'Nasi + Ayam Goreng + Sambal + Lalapan', 'paket', 6),
  ('Paket Makan 7', 22000, 'paket-makanan', '/images/playlist-poster.jpg', 'Nasi + Ayam Kampung + Sambal + Lalapan', 'paket', 7),
  ('Paket Makan 8', 25000, 'paket-makanan', '/images/village-tradition.jpg', 'Nasi + Ikan Bakar + Sambal + Lalapan', 'paket', 8),
  ('Paket Makan 9', 25000, 'paket-makanan', '/images/playlist-poster.jpg', 'Nasi + Ayam Bakar + Sambal + Lalapan', 'paket', 9),
  ('Paket Makan 10', 30000, 'paket-makanan', '/images/village-tradition.jpg', 'Nasi + Iga Bakar + Sambal + Lalapan', 'paket', 10),
  ('Pupuk Kompos', 25000, 'pupuk', '/images/village-panen.jpg', 'Pupuk kompos organik', 'karung', 11),
  ('Pupuk Cair Organik', 15000, 'pupuk', '/images/village-landscape.jpg', 'Pupuk cair untuk tanaman', 'botol', 12),
  ('Sewa Alat Pancing', 5000, 'fishing', '/images/wisata-sungai.jpg', 'Sewa alat pancing lengkap', 'set', 13),
  ('Pelet Umpan', 5000, 'fishing', '/images/wisata-keceh-air.jpg', 'Pelet umpan ikan berkualitas', 'bungkus', 14),
  ('Ikan Nila Segar', 38000, 'fishing', '/images/wisata-sungai.jpg', 'Ikan nila segar', 'kg', 15),
  ('Ikan Bawal Segar', 32000, 'fishing', '/images/wisata-keceh-air.jpg', 'Ikan bawal segar', 'kg', 16),
  ('Ikan Kalper Segar', 38000, 'fishing', '/images/wisata-sungai.jpg', 'Ikan kalper segar', 'kg', 17),
  ('Gula Aren Murni', 35000, 'oleh-oleh', '/images/wisata-jelajah.jpg', 'Gula aren asli 100% alami', 'kg', 18)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA — Tour Packages
-- ============================================================
INSERT INTO tour_packages (name, category, price, max_price, capacity, note, sort_order) VALUES
  -- Tiket
  ('HTM (Harga Tiket Masuk)', 'tiket', 5000, NULL, NULL, NULL, 1),
  ('Kolam Anak', 'tiket', 5000, NULL, NULL, NULL, 2),
  ('Wahana Permainan Anak', 'tiket', 10000, NULL, NULL, '/wahana', 3),
  ('Berenang', 'tiket', 5000, NULL, NULL, NULL, 4),
  -- Gratis
  ('Keceh Kali (Bermain Sungai)', 'gratis', 0, NULL, NULL, NULL, 5),
  ('Terapi Ikan', 'gratis', 0, NULL, NULL, NULL, 6),
  -- Aktivitas
  ('Tangkap Ikan', 'aktivitas', 10000, NULL, NULL, NULL, 7),
  ('Tanam Padi', 'aktivitas', 15000, NULL, NULL, NULL, 8),
  ('Tanam Sayur', 'aktivitas', 10000, NULL, NULL, NULL, 9),
  ('Cooking Class', 'aktivitas', 25000, NULL, NULL, NULL, 10),
  ('Fun Game (2 jam)', 'aktivitas', 15000, NULL, NULL, NULL, 11),
  ('Edukasi Pembuatan Gula Aren', 'aktivitas', 20000, NULL, NULL, NULL, 12),
  -- Sewa Tempat
  ('Pendopo (kap. 90-100 org)', 'sewa-tempat', 100000, NULL, '90-100 org', '/jam', 13),
  ('Pendopo Besar (kap. 40-50 org)', 'sewa-tempat', 75000, NULL, '40-50 org', '/jam', 14),
  ('Gazebo Bawah (kap. 20-25 org)', 'sewa-tempat', 30000, NULL, '20-25 org', '/jam', 15),
  ('Gazebo (kap. 30-40 org)', 'sewa-tempat', 50000, NULL, '30-40 org', '/jam', 16),
  ('Aula Dalam (kap. 35-40 org)', 'sewa-tempat', 75000, NULL, '35-40 org', '/jam', 17),
  ('Aula Teras (kap. 35-40 org)', 'sewa-tempat', 75000, NULL, '35-40 org', '/jam', 18),
  ('Aula Full (kap. 60-80 org)', 'sewa-tempat', 200000, NULL, '60-80 org', '/jam', 19),
  ('Aula Sungai (kap. 70-90 org)', 'sewa-tempat', 100000, NULL, '70-90 org', '/jam', 20),
  ('Outbound', 'sewa-tempat', 25000, NULL, NULL, '/jam', 21),
  ('Senam', 'sewa-tempat', 25000, NULL, NULL, '/acara', 22),
  -- Camping
  ('HTM Camp', 'camping', 5000, NULL, NULL, '/orang', 23),
  ('Spot Tenda', 'camping', 25000, NULL, NULL, NULL, 24),
  ('Spot Tenda Besar', 'camping', 40000, NULL, NULL, NULL, 25),
  ('Tenda Kapasitas 4 Orang', 'camping', 75000, NULL, NULL, NULL, 26),
  -- Homestay
  ('Aren 1 (2-5 org)', 'homestay', 200000, 300000, '2-5 org', NULL, 27),
  ('Aren 2 (2-5 org)', 'homestay', 200000, 300000, '2-5 org', NULL, 28),
  ('Aren 3 (6-8 org)', 'homestay', 375000, 500000, '6-8 org', NULL, 29),
  ('Aren 4 (8-10 org)', 'homestay', 450000, 575000, '8-10 org', NULL, 30),
  ('Extra Bed (100x220)', 'homestay', 25000, NULL, NULL, NULL, 31),
  ('Over Kapasitas', 'homestay', 10000, NULL, NULL, '/orang', 32),
  -- Fishing
  ('Sewa Alat Pancing', 'fishing', 5000, NULL, NULL, NULL, 33),
  ('Pelet Umpan', 'fishing', 5000, NULL, NULL, NULL, 34),
  ('Ikan Nila', 'fishing', 38000, NULL, NULL, '/kg', 35),
  ('Ikan Bawal', 'fishing', 32000, NULL, NULL, '/kg', 36),
  ('Ikan Kalper', 'fishing', 38000, NULL, NULL, '/kg', 37),
  -- Paket Edukasi
  ('Edu Trip Kesek 1', 'paket-edukasi', 35000, NULL, NULL, '/pax', 38),
  ('Edu Trip Kesek 2', 'paket-edukasi', 35000, NULL, NULL, '/pax', 39),
  ('Edu Trip Kesek 3', 'paket-edukasi', 50000, NULL, NULL, '/pax', 40),
  ('Edu Trip Kesek 4', 'paket-edukasi', 50000, NULL, NULL, '/pax', 41),
  ('Edu Trip Kesek 5', 'paket-edukasi', 80000, NULL, NULL, '/pax', 42),
  ('Package Edukasi 1', 'paket-edukasi', 90000, NULL, NULL, '/pax - HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Lunch + Welcome drink', 43),
  ('Package Edukasi 2', 'paket-edukasi', 100000, NULL, NULL, '/pax - HTM + Keceh Kali + Terapi Ikan + Fun Game + Lunch + Welcome drink', 44),
  ('Package Edukasi 3', 'paket-edukasi', 120000, NULL, NULL, '/pax - HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Fun Game + Lunch + Welcome drink', 45)
ON CONFLICT DO NOTHING;
