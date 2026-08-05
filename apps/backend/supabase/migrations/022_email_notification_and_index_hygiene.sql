-- 022: Notifikasi email + hygiene index.
-- 1) Drop index tak terpakai (verifikasi idx_scan = 0, semuanya non-unique).
-- 2) Tambah index untuk FK yang belum tercakup (advisor: unindexed_foreign_keys).
-- 3) Kolom anti-duplikat email di bookings.
-- 4) Toggle notifikasi email (1=aktif, 0=nonaktif) di booking_settings.

-- ---------- 1) unused indexes ----------
DROP INDEX IF EXISTS idx_bookings_source_ref;
DROP INDEX IF EXISTS idx_bookings_midtrans_status;
DROP INDEX IF EXISTS idx_bookings_stay_dates;
DROP INDEX IF EXISTS idx_payments_status;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_available;
DROP INDEX IF EXISTS idx_products_sort_order;
DROP INDEX IF EXISTS idx_products_category_available;
DROP INDEX IF EXISTS idx_tour_packages_category;
DROP INDEX IF EXISTS idx_tour_packages_available;
DROP INDEX IF EXISTS idx_tour_packages_category_available;
DROP INDEX IF EXISTS idx_rental_bookings_item_name;

-- ---------- 2) FK indexes ----------
CREATE INDEX IF NOT EXISTS idx_payments_verified_by ON payments (verified_by);
CREATE INDEX IF NOT EXISTS idx_rental_resource_conflicts_item ON rental_resource_conflicts (conflict_item_id);

-- ---------- 3) email dedupe flags ----------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_created_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email_sent_paid_at TIMESTAMPTZ;

-- ---------- 4) email notification toggle ----------
INSERT INTO booking_settings (key, group_name, label, value_numeric, unit, editable)
VALUES ('email_notification.enabled', 'email', 'Notifikasi Email (konfirmasi ke pelanggan)', 1, '1=aktif, 0=nonaktif', true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  editable = true;
