-- Menyimpan status teknis Midtrans agar UI dapat membedakan transaksi pending,
-- kedaluwarsa, dibatalkan, dan ditolak tanpa menjadikan frontend sebagai sumber kebenaran.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS midtrans_status TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_midtrans_status
  ON bookings(midtrans_status) WHERE midtrans_status IS NOT NULL;
