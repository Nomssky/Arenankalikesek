-- 008: Hapus kemampuan anon menulis langsung ke tabel booking.
-- Semua penulisan sekarang hanya lewat fungsi reserve_booking (service_role).
DROP POLICY IF EXISTS anon_insert_bookings ON bookings;
DROP POLICY IF EXISTS anon_insert_rentals ON rental_bookings;
