-- 015: Drop check constraint bookings_payment_method_check.
-- Constraint ad-hoc (tidak pernah ada di migration) hanya mengizinkan
-- NULL/cash/transfer/qris, sehingga memblokir:
--   1. Form admin "Tambah Booking Offline" (payment_method='offline') → 500.
--   2. Webhook Midtrans channel selain qris/cash/transfer (bank_transfer,
--      credit_card, dst.) → update gagal, pembayaran online tidak tercatat.
-- payment_method hanya data tampilan (invoice/admin), bukan trust boundary;
-- nilai berasal dari webhook Midtrans / route admin yang sudah diautentikasi.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;