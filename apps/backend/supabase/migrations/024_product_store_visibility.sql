-- 024: Daftar produk yang tampil di halaman Toko kini bersumber dari backend.
-- Sebelumnya frontend meng-hardcode ALLOWED_PRODUCTS (melanggar aturan "backend
-- source of truth"). Tambah kolom store_visible; admin menandai produk mana yang
-- boleh tampil di toko. Backend /api/products?store=true hanya mengirim yang true.
-- Produk ini (3 item saat ini) ditandai aktif agar perilaku toko tidak berubah.

ALTER TABLE products ADD COLUMN IF NOT EXISTS store_visible BOOLEAN NOT NULL DEFAULT false;

UPDATE products SET store_visible = true
WHERE name IN ('Pupuk Kompos', 'Pupuk Cair Organik', 'Gula Aren Murni');
