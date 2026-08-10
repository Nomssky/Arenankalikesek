-- 028: produk brand Sibisa di halaman Toko.
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