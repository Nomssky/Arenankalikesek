CREATE OR REPLACE FUNCTION check_rental_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rental_bookings
    WHERE item_id = NEW.item_id
      AND booking_date = NEW.booking_date
      AND status != 'cancelled'
      AND id != NEW.id
      AND time_start < COALESCE(NEW.time_end, NEW.time_start)
      AND COALESCE(time_end, time_start) > NEW.time_start
  ) THEN
    RAISE EXCEPTION 'Item sudah dibooking pada slot tersebut';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_rental_overlap ON rental_bookings;
CREATE TRIGGER trigger_check_rental_overlap
  BEFORE INSERT OR UPDATE ON rental_bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_rental_booking_overlap();
