-- ============================================================
-- Migration: Add indexes, constraints, and triggers
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Single-column indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(available);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_packages_category ON tour_packages(category);
CREATE INDEX IF NOT EXISTS idx_tour_packages_available ON tour_packages(available);
CREATE INDEX IF NOT EXISTS idx_tour_packages_sort_order ON tour_packages(sort_order);

-- 2. Composite indexes
CREATE INDEX IF NOT EXISTS idx_products_category_available ON products(category, available);
CREATE INDEX IF NOT EXISTS idx_tour_packages_category_available ON tour_packages(category, available);

-- 3. Trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to products
DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to tour_packages
DROP TRIGGER IF EXISTS trigger_tour_packages_updated_at ON tour_packages;
CREATE TRIGGER trigger_tour_packages_updated_at
  BEFORE UPDATE ON tour_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. CHECK constraints
ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
ALTER TABLE tour_packages ADD CONSTRAINT tour_packages_price_check CHECK (price >= 0);
ALTER TABLE tour_packages ADD CONSTRAINT tour_packages_max_price_check CHECK (max_price >= price OR max_price IS NULL);
