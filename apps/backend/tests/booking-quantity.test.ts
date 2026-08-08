import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolveBookingQuantity } from '@repo/shared-utils'

test('resolveBookingQuantity: paket edu-trip ditagih per peserta (bukan 1×)', () => {
  const qty = resolveBookingQuantity({
    isEdu: true,
    isRentalVenue: false,
    participantCount: 30,
    clientQuantity: 1,
  })
  assert.equal(qty, 30)
  assert.equal(
    resolveBookingQuantity({ isEdu: true, isRentalVenue: false, participantCount: 0 }),
    1,
  )
})

test('resolveBookingQuantity: venue per_jam dikali durasi, selain itu 1× per tanggal', () => {
  const perJam = resolveBookingQuantity({
    isEdu: false,
    isRentalVenue: true,
    venueUnit: 'jam',
    rentalDurationHours: 3,
  })
  assert.equal(perJam, 3)
  for (const unit of ['hari', 'malam', null]) {
    assert.equal(
      resolveBookingQuantity({ isEdu: false, isRentalVenue: true, venueUnit: unit, rentalDurationHours: 5 }),
      1,
      `venue unit=${unit} harus 1×`,
    )
  }
})

test('resolveBookingQuantity: item biasa ikut quantity client (minimal 1)', () => {
  assert.equal(resolveBookingQuantity({ isEdu: false, isRentalVenue: false, clientQuantity: 4 }), 4)
  assert.equal(resolveBookingQuantity({ isEdu: false, isRentalVenue: false, clientQuantity: 0 }), 1)
})

const bookingsRoute = readFileSync(
  new URL('../src/app/api/bookings/route.ts', import.meta.url),
  'utf8',
)

test('stay nonaktif (available=false) ditolak 409 (E2)', () => {
  assert.match(bookingsRoute, /if \(!service\.available\)/)
  assert.match(bookingsRoute, /Penginapan sedang ditutup sementara/)
})

test('total non-stay memakai resolveBookingQuantity (E1/E3 terpasang)', () => {
  assert.match(bookingsRoute, /resolveBookingQuantity\(/)
  assert.match(bookingsRoute, /isEduTripItem\(item\)/)
})

test('item gratis: total 0 → langsung confirmed+paid tanpa payment URL (E6)', () => {
  // parsedTotal === 0 -> status confirmed + payment_status paid, tidak melalui
  // branch createSnapTransaction (parsedTotal > 0 && isMidtransConfigured()).
  assert.match(bookingsRoute, /if \(parsedTotal > 0 && isMidtransConfigured\(\)\)/)
  assert.match(bookingsRoute, /if \(parsedTotal > 0\) \{[\s\S]*?status: 'pending'/)
})
