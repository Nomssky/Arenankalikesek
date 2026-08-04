-- ============================================================
-- Migrasi 010-013 — jalankan SEKALI di dashboard Supabase
-- (SQL editor, supabase.com → project → SQL → New query)
--
-- Sumber asli: supabase/migrations/010..013_*.sql
-- File ini salinan siap-tempel; jangan jalankan dua kali jika
-- 010-012 sudah pernah dijalankan (ON CONFLICT idempoten, tapi
-- trigger 011 akan ditimpa ulang — aman).
-- Setelah dijalankan, update supabase-schema.sql via export.
-- ============================================================

-- ---------- 010: camping & add-on prices ----------
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

-- ---------- 011: rental add-on prices + trigger overlap baru ----------
INSERT INTO booking_settings (key, group_name, label, value_numeric, unit)
VALUES
  ('rental.chair_price', 'rental', 'Sewa kursi', 3000, 'rupiah/unit'),
  ('rental.sound_system_price', 'rental', 'Sewa sound system', 300000, 'rupiah/paket'),
  ('rental.mat_price', 'rental', 'Sewa tikar', 10000, 'rupiah/unit')
ON CONFLICT (key) DO UPDATE
SET
  group_name = EXCLUDED.group_name,
  label = EXCLUDED.label,
  value_numeric = EXCLUDED.value_numeric,
  unit = EXCLUDED.unit,
  updated_at = now();

CREATE OR REPLACE FUNCTION check_rental_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_new_end TIME;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Baris tanpa jam mulai dianggap menutup satu hari penuh. Jika jam selesai
  -- lama kosong, perlakukan sebagai satu slot satu jam mulai dari time_start.
  v_new_end := COALESCE(NEW.time_end, NEW.time_start + INTERVAL '1 hour');

  PERFORM pg_advisory_xact_lock(
    hashtext('rental:' || NEW.item_id || ':' || NEW.booking_date::text)
  );

  IF EXISTS (
    SELECT 1
    FROM rental_bookings existing
    WHERE existing.item_id = NEW.item_id
      AND existing.booking_date = NEW.booking_date
      AND existing.status != 'cancelled'
      AND existing.id != NEW.id
      AND (
        NEW.time_start IS NULL
        OR existing.time_start IS NULL
        OR (
          NEW.time_start < COALESCE(existing.time_end, existing.time_start + INTERVAL '1 hour')
          AND v_new_end > existing.time_start
        )
      )
  ) THEN
    RAISE EXCEPTION 'Item sudah dibooking pada rentang waktu tersebut';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_rental_overlap ON rental_bookings;
CREATE TRIGGER trigger_check_rental_overlap
  BEFORE INSERT OR UPDATE ON rental_bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_rental_booking_overlap();

-- ---------- 012: sewa tenda per ukuran ----------
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

-- ---------- 013: kategori venue ('ruangan' → skema baru) ----------
UPDATE inventory_rentals
SET category = CASE
  WHEN id IN ('aula-dalam', 'aula-full', 'aula-sungai', 'aula-teras', 'joglo')
    THEN 'tempat-pertemuan'
  ELSE 'area-kegiatan' -- gazebo-atas, gazebo-bawah, panggung, pawon
END
WHERE category = 'ruangan';
