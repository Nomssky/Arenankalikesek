-- 019: Hold hanya untuk booking pending (online belum bayar).
-- Baris import spreadsheet (SPR-*) berstatus 'confirmed' oleh pengelola — event nyata
-- yang harus tetap tampil & memblokir slot, terlepas dari payment_status (uang bisa
-- dicatat kemudian). Migrasi 017 sebelumnya justru meng-hold semua yang belum dibayar,
-- sehingga 300+ event import hilang dari jadwal publik.

CREATE OR REPLACE FUNCTION sync_booking_resource_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        IF EXISTS (
          SELECT 1 FROM edu_trip_reservations
          WHERE booking_id = NEW.id AND status = 'hold'
        ) THEN
          PERFORM pg_advisory_xact_lock(
            hashtext('edu-trip:' || (
              SELECT booking_date::text FROM edu_trip_reservations WHERE booking_id = NEW.id LIMIT 1
            ))
          );
          IF (
            SELECT count(*) FROM edu_trip_reservations current_reservation
            WHERE current_reservation.booking_date = (
              SELECT booking_date FROM edu_trip_reservations WHERE booking_id = NEW.id LIMIT 1
            )
              AND current_reservation.status = 'active'
              AND current_reservation.booking_id <> NEW.id
          ) >= COALESCE((
            SELECT value_numeric::integer FROM booking_settings
            WHERE key = 'edu_trip.daily_quota'
          ), 2) THEN
            RAISE EXCEPTION 'Kuota Edu Trip sudah penuh saat pembayaran diterima';
          END IF;
        END IF;

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

-- Re-aktifkan resource milik booking confirmed yang terlanjur di-hold migrasi 017.
UPDATE rental_bookings r
SET status = 'active', updated_at = now()
FROM bookings b
WHERE b.id = r.booking_id
  AND b.status = 'confirmed'
  AND r.status = 'hold';

UPDATE accommodation_bookings a
SET status = 'active', updated_at = now()
FROM bookings b
WHERE b.id = a.booking_id
  AND b.status = 'confirmed'
  AND a.status = 'hold';

UPDATE edu_trip_reservations e
SET status = 'active', updated_at = now()
FROM bookings b
WHERE b.id = e.booking_id
  AND b.status = 'confirmed'
  AND e.status = 'hold';