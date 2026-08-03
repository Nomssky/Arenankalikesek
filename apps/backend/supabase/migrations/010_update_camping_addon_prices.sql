-- Menyamakan harga camping dan add-on dengan keputusan pengelola terbaru.
-- Sewa tenda terpisah tidak diubah karena nominalnya belum ditetapkan.

INSERT INTO booking_settings (key, group_name, label, value_numeric, unit)
VALUES
  ('camping.small_tent_price', 'camping', 'Tenda kecil per malam', 20000, 'rupiah/malam'),
  ('camping.large_tent_price', 'camping', 'Tenda besar per malam', 50000, 'rupiah/malam'),
  ('addon.firewood_price', 'add_on', 'Kayu bakar per paket', 25000, 'rupiah/paket'),
  ('addon.nesting_price', 'add_on', 'Sewa nesting', 50000, 'rupiah/unit'),
  ('addon.camping_chair_price', 'add_on', 'Sewa kursi camping', 10000, 'rupiah/unit')
ON CONFLICT (key) DO UPDATE
SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value_numeric = EXCLUDED.value_numeric,
  unit = EXCLUDED.unit,
  updated_at = now();
