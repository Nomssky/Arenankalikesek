-- Bersihkan artifact harga '/pax' yang menempel di kolom note tour_packages
-- (sisa seed lama; harga sebenarnya sudah ada di price/price_label).
-- Distinct: '/pax' -> NULL (kembali ke note fallback), '/pax - ...' -> deskripsi saja.

UPDATE tour_packages
SET note = NULLIF(regexp_replace(note, '^/pax\s*-?\s*', ''), '')
WHERE note LIKE '/pax%';