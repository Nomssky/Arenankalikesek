-- 032: Pengaman race pembayaran vs kedaluwarsa hold.
-- 1) expire_stale_booking_holds jangan membatalkan booking yang sudah lunas:
--    webhook/settlement Midtrans bisa tiba tepat saat hold expired, dan tanpa
--    guard ini booking yang sudah dibayar bisa ikut ter-cancel.
-- 2) sync_booking_resource_status di waktu pembayaran memeriksa kuota Edu Trip
--    untuk SEMUA tanggal booking (sebelumnya hanya tanggal pertama — booking
--    edu multi-tanggal bisa melewati kuota pada tanggal berikutnya) dan
--    menghitung hold+active seperti reserve_booking (020).

CREATE OR REPLACE FUNCTION expire_stale_booking_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE bookings
    SET status = 'cancelled', payment_status = 'unpaid', updated_at = now()
  WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at <= now()
    AND payment_status NOT IN ('paid', 'refunded');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION sync_booking_resource_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edu_date DATE;
  v_quota INTEGER;
  v_used INTEGER;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.status = 'cancelled' THEN
      UPDATE rental_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'returned';
      UPDATE accommodation_bookings SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
      UPDATE edu_trip_reservations SET status = 'cancelled', updated_at = now()
        WHERE booking_id = NEW.id;
    ELSIF NEW.payment_status IN ('refunded', 'partial_refund') THEN
      -- Refund ditangani admin sesuai aturan pembatalan; jangan melepas jadwal otomatis.
      NULL;
    ELSIF NEW.status = 'pending' THEN
      -- Online belum bayar: hold, tidak memblokir slot & tidak tampil di jadwal.
      UPDATE rental_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
      UPDATE accommodation_bookings SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
      UPDATE edu_trip_reservations SET status = 'hold', updated_at = now()
        WHERE booking_id = NEW.id AND status <> 'cancelled';
    ELSIF NEW.status IN ('paid', 'confirmed') THEN
      -- Dikonfirmasi pengelola/bayar lunas: aktif, tampil & memblokir slot.
      BEGIN
        -- Cek kuota Edu Trip untuk SEMUA tanggal booking (bukan hanya yang
        -- pertama), menghitung hold+active seperti reserve_booking.
        FOR v_edu_date IN
          SELECT DISTINCT booking_date FROM edu_trip_reservations
          WHERE booking_id = NEW.id AND status = 'hold'
        LOOP
          PERFORM pg_advisory_xact_lock(hashtext('edu-trip:' || v_edu_date::text));
          SELECT COALESCE(value_numeric, 2) INTO v_quota
            FROM booking_settings WHERE key = 'edu_trip.daily_quota';
          v_quota := COALESCE(v_quota, 2);
          SELECT count(*) INTO v_used
            FROM edu_trip_reservations current_reservation
            WHERE current_reservation.booking_date = v_edu_date
              AND current_reservation.status IN ('hold', 'active')
              AND current_reservation.booking_id <> NEW.id;
          IF v_used >= v_quota THEN
            RAISE EXCEPTION 'Kuota Edu Trip sudah penuh saat pembayaran diterima';
          END IF;
        END LOOP;

        UPDATE rental_bookings SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status NOT IN ('returned', 'cancelled');
        UPDATE accommodation_bookings SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status <> 'cancelled';
        UPDATE edu_trip_reservations SET status = 'active', updated_at = now()
          WHERE booking_id = NEW.id AND status <> 'cancelled';
      EXCEPTION WHEN OTHERS THEN
        UPDATE bookings
        SET notes = concat_ws(E'\n', NULLIF(notes, ''),
          '[KONFLIK JADWAL SETELAH PEMBAYARAN] Perlu penanganan admin.'),
          updated_at = now()
        WHERE id = NEW.id
          AND COALESCE(notes, '') NOT LIKE '%[KONFLIK JADWAL SETELAH PEMBAYARAN]%';
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;