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
WHERE NOT EXISTS (SELECT 1 FROM public.tour_packages WHERE slug = 'tambahan-tamu');