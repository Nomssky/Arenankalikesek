-- Menyamakan kategori katalog tempat dengan kategori booking baru
-- ('area-kegiatan' dan 'tempat-pertemuan'). Sebelumnya venue berkategori
-- 'ruangan' sehingga tidak pernah tampil di tab Sewa Tempat publik maupun
-- diproses sebagai sewa per-jam di backend.

UPDATE inventory_rentals
SET category = CASE
  WHEN id IN ('aula-dalam', 'aula-full', 'aula-sungai', 'aula-teras', 'joglo')
    THEN 'tempat-pertemuan'
  ELSE 'area-kegiatan' -- gazebo-atas, gazebo-bawah, panggung, pawon
END
WHERE category = 'ruangan';