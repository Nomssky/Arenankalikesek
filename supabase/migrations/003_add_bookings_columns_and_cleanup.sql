-- Add missing columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_pic TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_name TEXT;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_code ON bookings(booking_code);

-- Cleanup parking_bookings references (table was never created)
DROP INDEX IF EXISTS idx_parking_bookings_status;
DROP INDEX IF EXISTS idx_parking_bookings_date;
DROP INDEX IF EXISTS idx_parking_bookings_created;
DROP TRIGGER IF EXISTS trigger_parking_bookings_updated_at ON parking_bookings;
