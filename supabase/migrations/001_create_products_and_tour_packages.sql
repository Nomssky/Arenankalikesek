-- ============================================================
-- Migration: Create products + tour_packages tables
-- Run this in Supabase Dashboard -> SQL Editor
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

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read tour_packages" ON tour_packages;
CREATE POLICY "Public read tour_packages" ON tour_packages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service write products" ON products;
CREATE POLICY "Service write products" ON products FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Service write tour_packages" ON tour_packages;
CREATE POLICY "Service write tour_packages" ON tour_packages FOR ALL USING (false) WITH CHECK (false);

-- Harga publik tidak disimpan ulang di migration ini.
-- Sumber data terpusat: src/data/pricing.ts
