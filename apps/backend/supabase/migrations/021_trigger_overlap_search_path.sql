-- 021: Hardening search_path trigger overlap (linter: function_search_path_mutable).
-- check_rental_booking_overlap dijalankan oleh trigger rental_bookings; kunci
-- search_path ke public agar tidak mengikuti skema sesi (defense-in-depth,
-- fungsi ini bukan SECURITY DEFINER sehingga risikonya minimal — ini hanya
-- menghilangkan warning advisor dan menyamakan pola dengan reserve_booking).

CREATE OR REPLACE FUNCTION check_rental_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_new_end TIME;
BEGIN
  -- hold pun mengunci slot; hanya baris batal/selesai yang netral.
  IF NEW.status IN ('cancelled', 'returned') THEN
    RETURN NEW;
  END IF;

  v_new_end := COALESCE(NEW.time_end, NEW.time_start + INTERVAL '1 hour');

  PERFORM pg_advisory_xact_lock(
    hashtext('rental:' || NEW.item_id || ':' || NEW.booking_date::text)
  );

  IF EXISTS (
    SELECT 1
    FROM rental_bookings existing
    WHERE existing.item_id = NEW.item_id
      AND existing.booking_date = NEW.booking_date
      AND existing.status IN ('hold', 'active')
      AND existing.id <> NEW.id
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
$$ LANGUAGE plpgsql
SET search_path = public;
