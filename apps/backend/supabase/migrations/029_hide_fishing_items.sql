-- 029: sembunyikan item wahana/fishing dari tampilan publik via backend.
-- Sebelumnya frontend meng-hardcode id (terapi-ikan, kolam-pancing,
-- sewa-alat-pancing, pelet-umpan) untuk menyembunyikannya di /wisata & /jadwal.
-- Kini keputusan jadi data backend: available=false membuat item tidak dikirim
-- GET /api/tour-packages?available=true (pelet-umpan sudah tidak ada di DB).
-- Idempoten: hanya menyasar baris yang masih available=true.

UPDATE public.tour_packages
SET available = false,
    updated_at = now()
WHERE slug IN ('terapi-ikan', 'kolam-pancing', 'sewa-alat-pancing')
  AND available = true;
