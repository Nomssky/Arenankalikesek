-- Migration 004: Add Midtrans support columns and update constraints

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id TEXT;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial_refund'));
