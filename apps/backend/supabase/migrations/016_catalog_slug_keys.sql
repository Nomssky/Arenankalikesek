-- Katalog harga menjadi sumber DB (pola venue: DB otoritatif + pricing.ts fallback).
-- Booking menggunakan item id slug (mis. 'aren-1', 'atv-anak', 'paket-menu-1'),
-- sedangkan tour_packages/products ber-id uuid sehingga tidak pernah tersambung.
-- Tambahkan kolom slug sebagai kunci katalog agar harga DB benar-benar dipakai,
-- plus price_type (fixed/range/free/rates) dan rates jsonb (homestay weekday/weekend/holiday).

ALTER TABLE tour_packages
  ADD COLUMN slug text,
  ADD COLUMN price_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN rates jsonb;

ALTER TABLE products
  ADD COLUMN slug text,
  ADD COLUMN price_type text NOT NULL DEFAULT 'fixed';

CREATE UNIQUE INDEX tour_packages_slug_key ON tour_packages (slug) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX products_slug_key ON products (slug) WHERE slug IS NOT NULL;