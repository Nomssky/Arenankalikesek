-- Migration 030: izinkan satu booking memuat beberapa tipe akomodasi.
-- Detail tiap unit tetap disimpan pada accommodation_bookings.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_accommodation_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_accommodation_type_check
  CHECK (accommodation_type IS NULL OR accommodation_type IN ('homestay', 'camping', 'glamping', 'mixed'));
