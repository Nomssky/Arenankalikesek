ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_item_id_fkey;

ALTER TABLE rental_bookings ADD COLUMN IF NOT EXISTS item_name TEXT;

ALTER TABLE rental_bookings DROP CONSTRAINT IF EXISTS rental_bookings_booking_id_fkey;
ALTER TABLE rental_bookings ADD CONSTRAINT rental_bookings_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(id);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_item_name ON rental_bookings(item_name);
