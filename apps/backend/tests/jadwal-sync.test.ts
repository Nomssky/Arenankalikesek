// Uji parser jadwal-sync (fungsi murni — tanpa jaringan, tanpa DB).
// Kasus diambil dari data nyata sheet JANUARI/AGUSTUS 2026.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const {
  parseCsv,
  parseDateLenient,
  parseJam,
  petakanKolom,
  resolveVenue,
  mapUnitAkomodasi,
  bangunSewa,
  bangunPenginapan,
} = await import('../src/lib/jadwal-sync.ts')

test('parseCsv menangani kutip, koma dalam kutip, dan baris kosong', () => {
  const rows = parseCsv('"a","b,c"\n"x,y","z"\n\n"baris\nbaru",2')
  assert.deepEqual(rows, [
    ['a', 'b,c'],
    ['x,y', 'z'],
    ['baris\nbaru', '2'],
  ])
})

test('parseDateLenient: format standar, tahun pendek, dan tolak sampah', () => {
  assert.equal(parseDateLenient('02/09/2026'), '2026-09-02')
  // Kasus nyata sheet penginapan: "21/8/6" maksudnya 2026.
  assert.equal(parseDateLenient('21/8/6'), '2026-08-21')
  assert.equal(parseDateLenient('13/8/26'), '2026-08-13')
  assert.equal(parseDateLenient('Reny'), null)
  assert.equal(parseDateLenient('32/13/2026'), null)
})

test('parseJam: varian nyata dari sheet', () => {
  assert.deepEqual({ ...parseJam('10.00 - 11.00') }, { start: '10:00', end: '11:00' })
  const selesai = parseJam('09.00-SELESAI')
  assert.equal(selesai.start, '09:00')
  assert.equal(selesai.returned, true)
  assert.deepEqual({ ...parseJam('12.00 / menginap') }, { start: '12:00' })
  assert.deepEqual(parseJam('-'), {})
  // Nama orang di kolom JAM bukan jam.
  assert.deepEqual(parseJam('Reny'), {})
  // "08.00/30 orang tikar 4" → mulai 08.00, sisanya noise.
  assert.equal(parseJam('08.00/30 orang  tikar 4').start, '08:00')
  // Jam polos tanpa menit: "8-11.00".
  const polos = parseJam('8-11.00')
  assert.equal(polos.start, '08:00')
  assert.equal(polos.end, '11:00')
})

test('petakanKolom: urutan kolom bebas + sinonim; tanpa TANGGAL → null', () => {
  const peta = petakanKolom(['PENYEWA', 'NOMOR HP', 'TANGGAL', 'TEMPAT', 'JAM', 'KETERANGAN'])
  assert.equal(peta?.tanggal, 2)
  assert.equal(peta?.tempat, 3)
  assert.equal(peta?.hp, 1)
  assert.equal(peta?.penyewa, 0)
  assert.equal(petakanKolom(['A', 'B']), null)
})

test('resolveVenue: katalog, EXTRA_PLACES, gabungan, dan venue baru', () => {
  const katalog = [
    { item_id: 'joglo', item_name: 'Joglo', key: 'joglo' },
    { item_id: 'pawon', item_name: 'Pawon', key: 'pawon' },
    { item_id: 'gazebo-bawah', item_name: 'Gazebo Bawah', key: 'gazebo bawah' },
  ]
  assert.deepEqual(resolveVenue('JOGLO ', katalog).map((v) => v.item_id), ['joglo'])
  // Typo GASEBO dinormalkan; kebetulan nama di katalog.
  assert.deepEqual(resolveVenue('GASEBO BAWAH', katalog).map((v) => v.item_id), ['gazebo-bawah'])
  // Gabungan CAMP/TUTIK → satu tempat camp-area.
  assert.deepEqual(resolveVenue('CAMP/TUTIK', []).map((v) => v.item_id), ['camp-area'])
  // Tempat tak dikenal → venue baru dari slug (pola EXTRA_PLACES fallback).
  const baru = resolveVenue('Pendopo Baru', [])[0]
  assert.equal(baru.item_id, 'pendopo-baru')
  assert.equal(baru.item_name, 'Pendopo Baru')
})

test('mapUnitAkomodasi: aren/camp/glamping dikenali, aneh ditolak', () => {
  assert.equal(mapUnitAkomodasi('AREN 2')?.item_id, 'aren-2')
  assert.equal(mapUnitAkomodasi('glamping 2')?.item_id, 'glamping')
  assert.equal(mapUnitAkomodasi('CAMP')?.item_id, 'camping-ground')
  assert.equal(mapUnitAkomodasi('SAMPING GLAMPING'), null)
})

const CSV_SEWA = [
  'TANGGAL,TEMPAT,JAM,PENYEWA,ALAMAT,KETERANGAN,NOMOR HP,PIC',
  '04/01/2026,JOGLO,10.00-12.00,BU UMI,PAK SEKDES,LUNAS 4/11 TF BMD,,ARIK',
  ',GAZEBO ATAS,09.00-SELESAI,BU PRIKA,,,',
  '"16/01/2026","CAMP/TUTIK","16.00","PAK RIFAI","","TENDA 2, DP 100 CASH 13/1","",',
  '21/01/2025,PANGGUNG,08.00-SELESAI,OUTING CLASS,,,',
  ',,,,,,,',
].join('\n')

function katalog() {
  return [{ item_id: 'joglo', item_name: 'Joglo', key: 'joglo' }]
}

test('bangunSewa: pewarisan tanggal/tempat, typo tahun, EDU, lunas, double-book', () => {
  const hasil = bangunSewa([{ nama: 'JANUARI', csv: CSV_SEWA }], katalog())
  // 4 baris valid (1 kosong dilewati).
  assert.equal(hasil.bookings.length, 4)
  assert.deepEqual(hasil.perTab, [{ nama: 'JANUARI', jumlah: 4 }])
  const [umi, prika, , outing] = hasil.bookings

  // Pewarisan tanggal merged-cell untuk baris kedua.
  assert.equal(umi.booking_date, '2026-01-04')
  assert.equal(prika.booking_date, '2026-01-04')
  assert.equal(umi.payment_status, 'paid')
  // Typo tahun 2025 → 2026.
  assert.equal(outing.booking_date, '2026-01-21')
  // OUTING CLASS → entri kuota eduTrip.
  assert.equal(hasil.edu.length, 1)
  assert.equal(hasil.edu[0].booking_id, outing.id)

  // Double-book pada JOGLO tanggal sama? Tidak ada di contoh ini — semua unik.
  const rentalJoglo = hasil.rentals.filter((r) => r.item_id === 'joglo')
  assert.ok(rentalJoglo.every((r) => r.status === 'active'))

  // Kode berurutan SPR-yyyyMM-nnnn (format sama dengan impor manual).
  assert.match(String(umi.id), /^SPR-\d{6}-\d{4}$/)
})

test('bangunSewa: double-book slot sama → kedua tercatat, yang kalah cancelled', () => {
  const csv = [
    'TANGGAL,TEMPAT,JAM,PENYEWA,ALAMAT,KETERANGAN,NOMOR HP,PIC',
    '05/01/2026,JOGLO,10.00-12.00,A,,,',
    ',JOGLO,11.00-13.00,B,,,',
  ].join('\n')
  const hasil = bangunSewa([{ nama: 'JANUARI', csv }], katalog())
  assert.equal(hasil.bookings.length, 2)
  const aktif = hasil.rentals.filter((r) => r.status === 'active').length
  const batal = hasil.rentals.filter((r) => r.status === 'cancelled').length
  assert.equal(aktif, 1)
  assert.equal(batal, 1)
})

test('bangunSewa: kolom acak tetap terbaca lewat nama header', () => {
  const csv = [
    'PENYEWA,NOMOR HP,TANGGAL,TEMPAT,JAM,KETERANGAN,CATATAN TAMBAHAN',
    'BU UMI,,04/01/2026,JOGLO,10-12,LUNAS,kolom asing diabaikan',
  ].join('\n')
  const hasil = bangunSewa([{ nama: 'JANUARI', csv }], katalog())
  assert.equal(hasil.bookings.length, 1)
  assert.equal(hasil.bookings[0].payment_status, 'paid')
})

test('bangunSewa: header rusak ketimpa isi → fallback urutan kolom standar', () => {
  // Kasus nyata tab AGUSTUS: tiga sel header tertimpa ("b","00","0").
  const csv = [
    'b,00,0,PENYEWA,ALAMAT,KETERANGAN,NOMOR HP,PIC',
    '04/08/2026,AULA DALAM,12-14.00,PATEBON,,,,',
    ',JOGLO,8-10.00,RINA,,,08156692288,',
  ].join('\n')
  const hasil = bangunSewa([{ nama: 'AGUSTUS', csv }], katalog())
  assert.ok(hasil.masalah.some((m) => m.includes('urutan kolom standar')))
  assert.equal(hasil.bookings.length, 2)
  assert.equal(hasil.bookings[0].booking_date, '2026-08-04')
  // Pewarisan tempat untuk baris kedua tetap bekerja.
  assert.equal(hasil.bookings[1].booking_date, '2026-08-04')
})

test('bangunPenginapan: 1 baris = 1 malam, dedupe unit+tanggal, catatan utuh', () => {
  const csv = [
    'TANGGAL,UNIT,PENYEWA,NOMOR HP,CHEK IN,CHEK OUT,KETERANGAN,DP,PIC',
    '1/8/2026,AREN 2,WIDI,+62 857-7509-6359,BED 1,ARIS,DP 500 TF 22/6,,ARIK',
    ',Glamping 2,PAK AZIZ,,,lunas 300 ilham,,,ARIS',
    ',SAMPING GLAMPING,MBAK SANTI,tenda 2,,,,,,',
    ',aren 2,WIDI LAGI,,,BED 3,,,,,',
  ].join('\n')
  const hasil = bangunPenginapan([{ nama: 'AGUSTUS', csv }])
  // aren 2 dobel → dedupe; SAMPING GLAMPING → dilewati + dilaporkan.
  assert.equal(hasil.bookings.length, 2)
  assert.equal(hasil.akomodasi.length, 2)
  assert.ok(hasil.masalah.some((m) => m.includes('unit tak dikenali')))

  const widi = hasil.bookings[0]
  assert.equal(widi.check_in_date, '2026-08-01')
  assert.equal(widi.check_out_date, '2026-08-02')
  assert.equal(widi.nights, 1)
  assert.equal(widi.customer_phone, '6285775096359')
  assert.equal(widi.payment_status, 'paid')
  assert.match(String(widi.notes), /BED\/TENDA: BED 1/)
  assert.match(String(widi.notes), /PETUGAS: ARIS/)
  assert.equal(hasil.akomodasi[0].accommodation_type, 'homestay')
  assert.equal(hasil.akomodasi[1].item_id, 'glamping')
})

test('bangunPenginapan: tanggal tahun pendek "21/8/6"', () => {
  const csv = ['TANGGAL,UNIT,PENYEWA,NOMOR HP,CHEK IN,CHEK OUT,KETERANGAN,DP,PIC', '21/8/6,GLAMPING 1,OBUY,PROYEK,,,,,,'].join('\n')
  const hasil = bangunPenginapan([{ nama: 'AGUSTUS', csv }])
  assert.equal(hasil.bookings.length, 1)
  assert.equal(hasil.bookings[0].check_in_date, '2026-08-21')
})
