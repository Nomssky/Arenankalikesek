import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/007_booking_accommodation_and_quota.sql', import.meta.url),
  'utf8',
)
const invoiceRoute = readFileSync(
  new URL('../src/app/api/invoice/[id]/route.ts', import.meta.url),
  'utf8',
)
const rentalOverlapMigration = readFileSync(
  new URL('../supabase/migrations/011_rental_overlap_and_addon_prices.sql', import.meta.url),
  'utf8',
)
const publicScheduleRoute = readFileSync(
  new URL('../src/app/api/schedule/route.ts', import.meta.url),
  'utf8',
)
const adminRentalsRoute = readFileSync(
  new URL('../src/app/api/admin/rentals/route.ts', import.meta.url),
  'utf8',
)
const adminAccommodationsRoute = readFileSync(
  new URL('../src/app/api/admin/accommodations/route.ts', import.meta.url),
  'utf8',
)
const paymentHoldMigration = readFileSync(
  new URL('../supabase/migrations/017_payment_hold_before_active_schedule.sql', import.meta.url),
  'utf8',
)

test('migrasi memiliki proteksi overlap penginapan di database', () => {
  assert.match(migration, /EXCLUDE USING gist/)
  assert.match(migration, /daterange\(check_in_date, check_out_date, '\[\)'\) WITH &&/)
  assert.match(migration, /WHEN exclusion_violation/)
})

test('kuota Edu Trip dikunci dalam transaksi untuk mencegah race condition', () => {
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /edu_trip\.daily_quota/)
  assert.match(migration, /Kuota Edu Trip pada tanggal tersebut sudah penuh/)
})

test('bentrok sewa tempat memeriksa seluruh rentang dan dikunci per item/tanggal', () => {
  assert.match(rentalOverlapMigration, /pg_advisory_xact_lock/)
  assert.match(rentalOverlapMigration, /NEW\.time_start < COALESCE\(existing\.time_end/)
  assert.match(rentalOverlapMigration, /v_new_end > existing\.time_start/)
  assert.match(rentalOverlapMigration, /existing\.status != 'cancelled'/)
})

test('bucket dokumen wajib privat, JPEG, dan maksimal 5 MB', () => {
  assert.match(migration, /'booking-documents', 'booking-documents', false, 5242880/)
  assert.match(migration, /ARRAY\['image\/jpeg'\]/)
  assert.match(migration, /DROP POLICY IF EXISTS "Public read booking documents"/)
})

test('invoice tidak memilih jenis maupun path dokumen identitas', () => {
  const selectExpression = invoiceRoute.match(/\.select\('([^']+)'\)/)?.[1] || ''
  assert.doesNotMatch(selectExpression, /document_type/)
  assert.doesNotMatch(selectExpression, /document_storage_path/)
})

test('jadwal aktif hanya memuat booking dengan status lunas/confirmed', () => {
  for (const route of [publicScheduleRoute, adminRentalsRoute, adminAccommodationsRoute]) {
    assert.match(route, /bookings\.status'\s*,\s*\['paid', 'confirmed'\]/)
  }
})

test('resource pending menjadi hold dan baru aktif setelah pembayaran', () => {
  assert.match(paymentHoldMigration, /status IN \('hold', 'active'/)
  assert.match(paymentHoldMigration, /NEW\.status = 'pending'/)
  assert.match(paymentHoldMigration, /SET status = 'hold'/)
  assert.match(paymentHoldMigration, /NEW\.status IN \('paid', 'confirmed'\)/)
  assert.match(paymentHoldMigration, /SET status = 'active'/)
})

test('hold mengunci slot: overlap trigger & penginapan menyertakan status hold (migrasi 020)', () => {
  const holdBlocksMigration = readFileSync(
    new URL('../supabase/migrations/020_hold_blocks_slot.sql', import.meta.url),
    'utf8',
  )
  assert.match(holdBlocksMigration, /NEW\.status IN \('cancelled', 'returned'\)/)
  assert.match(holdBlocksMigration, /existing\.status IN \('hold', 'active'\)/)
  assert.match(holdBlocksMigration, /WHERE \(status IN \('hold', 'active'\)\)/)
})
