-- 014: Revoke EXECUTE dari anon/authenticated untuk RPC lama yang tidak dipakai.
-- Semua request memakai service_role (getSupabaseAdmin) — reserve_booking/
-- expire_stale_booking_holds sudah service_role-only sejak migration 008.
-- Fungsi trigger (sync_booking_resource_status) tetap jalan via service_role;
-- is_staff TIDAK diubah karena dipakai policy RLS staff_manage_*.
REVOKE ALL ON FUNCTION public.create_rental_booking(text, integer, timestamptz, timestamptz, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_rental_availability(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_booking_resource_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_rental_booking(text, integer, timestamptz, timestamptz, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rental_availability(text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_booking_resource_status() TO service_role;