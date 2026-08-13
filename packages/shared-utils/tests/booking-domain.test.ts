import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCampingTotal,
  calculateExtraGuestTotal,
  calculateHomestayBase,
  cartMixingError,
  dateRangeContainsBlockedDate,
  differenceInNights,
} from '../src/index.ts'

test('menghitung minimal satu malam dan menolak rentang terbalik', () => {
  assert.equal(differenceInNights('2026-08-01', '2026-08-02'), 1)
  assert.throws(() => differenceInNights('2026-08-02', '2026-08-02'))
})

test('harga homestay otomatis membedakan weekday dan weekend', () => {
  const result = calculateHomestayBase('2026-08-07', '2026-08-10', 200_000, [
    { label: 'Weekday', price: 200_000 },
    { label: 'Weekend', price: 250_000 },
    { label: 'Holiday', price: 300_000 },
  ])
  assert.equal(result.weekdayNights, 1)
  assert.equal(result.weekendNights, 2)
  assert.equal(result.baseTotal, 700_000)
})

test('biaya tambahan hanya berlaku untuk Aren 1/2 di atas lima tamu', () => {
  assert.equal(calculateExtraGuestTotal('aren-1', 7, 2), 20_000)
  assert.equal(calculateExtraGuestTotal('aren-1', 7, 5), 20_000)
  assert.equal(calculateExtraGuestTotal('aren-3', 12, 2), 0)
})

test('harga camping mengikuti ukuran, jumlah tenda, malam, dan add-on', () => {
  const result = calculateCampingTotal({
    tentSize: 'large',
    tentCount: 2,
    tentOption: 'own',
    nights: 3,
    firewoodPackages: 2,
    nestingQuantity: 1,
    chairQuantity: 2,
  })
  assert.equal(result.groundTotal, 300_000)
  assert.equal(result.addOnTotal, 120_000)
  assert.equal(result.total, 420_000)
  assert.deepEqual(result.unavailablePrices, [])
})

test('harga sewa tenda mengikuti ukuran tenda', () => {
  const result = calculateCampingTotal({
    tentSize: 'small',
    tentCount: 1,
    tentOption: 'rent',
    nights: 1,
    nestingQuantity: 1,
  })
  assert.equal(result.rentalTotal, 20_000)
  assert.equal(result.total, 90_000)
  assert.deepEqual(result.unavailablePrices, [])
})

test('rentang tanggal mendeteksi tanggal yang sudah terisi', () => {
  assert.equal(
    dateRangeContainsBlockedDate('2026-08-01', '2026-08-04', ['2026-08-03']),
    true,
  )
  assert.equal(
    dateRangeContainsBlockedDate('2026-08-01', '2026-08-04', ['2026-08-04']),
    false,
  )
})

test('campur keranjang: menginap hanya boleh digabung wahana/aktivitas', () => {
  const aren = { id: 'aren-1', category: 'homestay' }
  const wahana = { id: 'atv-anak', category: 'aktivitas' }
  const edu = { id: 'edu-trip-kesek-1', category: 'paket-edukasi' }
  const kegiatan = { id: 'kegiatan-x', category: 'paket-kegiatan' }
  const venue = { id: 'aula-full', category: 'tempat-pertemuan' }
  const area = { id: 'gazebo-atas', category: 'area-kegiatan' }

  assert.equal(cartMixingError([], [wahana]), null)
  assert.equal(cartMixingError([aren], [wahana]), null)
  assert.equal(cartMixingError([wahana], [aren]), null)
  assert.equal(cartMixingError([edu], [venue]), null)
  assert.equal(cartMixingError([wahana], [edu]), null)
  assert.match(cartMixingError([aren], [edu]) || '', /hanya bisa digabung/)
  assert.match(cartMixingError([edu], [aren]) || '', /hanya bisa digabung/)
  assert.match(cartMixingError([aren], [venue]) || '', /hanya bisa digabung/)
  assert.match(cartMixingError([area], [aren]) || '', /hanya bisa digabung/)
  assert.match(cartMixingError([aren, wahana], [kegiatan]) || '', /hanya bisa digabung/)
})
