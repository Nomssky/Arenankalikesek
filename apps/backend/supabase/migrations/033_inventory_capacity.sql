-- Kapasitas venue sewa tempat untuk tampilan /jadwal (sebelumnya hanya ada
-- di fallback pricing.ts / tour_packages dengan id berbeda). Nilai diisi dari
-- fallback pricing.ts agar konsisten dengan tampilan /wisata. Form admin
-- inventory dapat mengubahnya setelah ini.

ALTER TABLE inventory_rentals ADD COLUMN capacity text;

UPDATE inventory_rentals SET capacity = CASE name
  WHEN 'Aula Dalam' THEN '35–40 orang'
  WHEN 'Aula Teras' THEN '35–40 orang'
  WHEN 'Aula Full' THEN '60–80 orang'
  WHEN 'Aula Sungai' THEN '70–90 orang'
  WHEN 'Joglo' THEN '40–50 orang'
  WHEN 'Pawon' THEN '30–40 orang'
  WHEN 'Gazebo Atas' THEN '20–25 orang'
  WHEN 'Gazebo Bawah' THEN '20–25 orang'
  WHEN 'Panggung' THEN '40–50 orang'
  ELSE capacity
END;