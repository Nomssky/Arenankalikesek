-- Harga sewa tenda disamakan dengan harga camping ground berdasarkan ukuran.

INSERT INTO booking_settings (key, group_name, label, value_numeric, unit)
VALUES
  ('camping.small_tent_rental_price', 'camping', 'Sewa tenda kecil per malam', 20000, 'rupiah/tenda/malam'),
  ('camping.large_tent_rental_price', 'camping', 'Sewa tenda besar per malam', 50000, 'rupiah/tenda/malam')
ON CONFLICT (key) DO UPDATE
SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value_numeric = EXCLUDED.value_numeric,
  unit = EXCLUDED.unit,
  updated_at = now();
