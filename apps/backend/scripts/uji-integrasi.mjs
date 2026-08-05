// Uji integrasi menyeluruh: keselarasan DB ↔ jadwal & backend ↔ frontend untuk semua tipe booking.
// Pakai shared-utils (kode yang sama dipakai FE/backend) sebagai patokan harga; tiap booking uji
// dicancel setelah diverifikasi (self-cleaning). Jalankan: node --experimental-strip-types uji-integrasi.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  calculateHomestayBase,
  calculateExtraGuestTotal,
  calculateCampingTotal,
  differenceInNights,
} from '../../../packages/shared-utils/src/booking-domain.ts'

const API = 'http://127.0.0.1:3000'
const JPEG_1PX = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda0008010100003f00f7dfd9ff00f50000000000000000ffd9'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const checks = { pass: 0, fail: 0 }
function check(label, cond, detail = '') {
  if (cond) { checks.pass += 1; console.log(`  ✓ ${label}`) }
  else { checks.fail += 1; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function daysFromNow(n) {
  const d = new Date(Date.now() + n * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
async function api(path, init) {
  const res = await fetch(`${API}${path}`, init)
  let body = null
  const text = await res.text()
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body }
}
const get = (p, cookie) => api(p, cookie ? { headers: { Cookie: cookie } } : undefined)
const post = (p, data) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
const postForm = (p, form) => api(p, { method: 'POST', body: form })
const patch = (p, data) => api(p, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
const phone = () => `08${String(Math.floor(100000000 + Math.random() * 899999999))}` // 08 + 9 digit

// Invoice publik hanya terbuka setelah lunas (payment-hold). Uji integrasi
// membuka invoice sebagai admin (login sekali) agar bisa memverifikasi total
// server terhadap shared-utils sebelum pembayaran disimulasikan.
let adminCookie = ''
async function loginAdmin() {
  const res = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const match = /admin_token=([^;]+)/.exec(setCookie)
  adminCookie = match ? `admin_token=${match[1]}` : ''
  return res.status === 200 && Boolean(adminCookie)
}
const invoiceOf = async (id, hp) => {
  const res = await fetch(`${API}/api/invoice/${id}?phone=${hp}`, { headers: { Cookie: adminCookie } })
  let body = null
  const text = await res.text()
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, body }
}

const settings = {}
async function loadSettings() {
  const { body } = await api('/api/booking-config')
  const raw = body.settings || body
  for (const k of Object.keys(raw)) settings[k] = raw[k] ?? null
}

// Self-cleaning: cancel pending booking uji yang tertinggal dari run sebelumnya (mis. run gagal).
async function purgeLeftovers() {
  const { data: leftovers } = await sb.from('bookings')
    .select('id').eq('status', 'pending').like('customer_name', 'Uji %')
  for (const b of leftovers || []) {
    await sb.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', b.id)
    await sb.from('rental_bookings').update({ status: 'cancelled' }).eq('booking_id', b.id).neq('status', 'returned')
  }
  return (leftovers || []).length
}

console.log('\n== A. DB ↔ jadwal ==')
{
  const purged = await purgeLeftovers()
  check('bersihkan pending sisa dari run sebelumnya', purged === 0, `${purged} di-cancel`)
  await loadSettings()
  const adminOk = await loginAdmin()
  check('login admin (untuk akses invoice pra-pembayaran)', adminOk)
  const { data: dbRows } = await sb.from('rental_bookings')
    .select('item_id,time_start,time_end,booking_date')
    .neq('status', 'cancelled')
    .in('booking_date', ['2026-10-18'])
  const want = (dbRows || []).map((r) => JSON.stringify({ item_id: r.item_id, time_start: r.time_start || '', time_end: r.time_end || '', booking_date: r.booking_date })).sort()
  const { body: sched } = await get('/api/schedule?start_date=2026-10-18&end_date=2026-10-18')
  const got = (Array.isArray(sched) ? sched : []).map((r) => JSON.stringify({ item_id: r.item_id, time_start: r.time_start, time_end: r.time_end, booking_date: r.booking_date })).sort()
  check('jadwal API == rental_bookings (2026-10-18)', JSON.stringify(want) === JSON.stringify(got), `DB ${want.length} vs API ${got.length}`)

  const eduDate = daysFromNow(6)
  const { data: eduDb } = await sb.from('edu_trip_reservations').select('booking_date').in('status', ['hold', 'active']).eq('booking_date', eduDate)
  const quota = settings['edu_trip.daily_quota'] ?? 2
  const { body: eduApi } = await get(`/api/edu-trip-availability?date=${eduDate}`)
  check(`kuota edu == DB (${eduDate}, hold+active)`, eduApi.used === (eduDb || []).length && eduApi.remaining === Math.max(0, quota - (eduDb || []).length), `quota ${quota} used ${eduApi.used} rem ${eduApi.remaining} db ${(eduDb || []).length}`)
}

console.log('\n== B. Harga venue publik == DB ==')
{
  const { data: db } = await sb.from('inventory_rentals').select('id,price_per_unit,available').in('category', ['area-kegiatan', 'tempat-pertemuan'])
  const { body: pub } = await get('/api/inventory-rentals')
  const mDb = new Map((db || []).map((r) => [r.id, r]))
  const mPub = new Map((pub || []).map((r) => [r.id, r]))
  check('set venue sama', mDb.size === mPub.size)
  let allSame = true
  for (const [id, r] of mDb) { if (mPub.get(id)?.price_per_unit !== r.price_per_unit || mPub.get(id)?.available !== r.available) allSame = false }
  check('harga & available venue sama', allSame, [...mPub.entries()].map(([i, r]) => `${i}:${r.price_per_unit}`).join(' '))
}

const created = []
async function cancelBooking(id, hp) {
  const r = await patch(`/api/bookings/${id}/cancel`, { phone: hp })
  return r.status >= 200 && r.status < 300
}

console.log('\n== C. Sewa tempat per jam (venue) ==')
{
  const D = daysFromNow(2)
  const { data: aula } = await sb.from('inventory_rentals').select('price_per_unit').eq('id', 'aula-full').single()
  const hargaAula = aula.price_per_unit
  const expected = hargaAula * 3 + 2 * 3000 + 300000 + 10000
  const hpC1 = phone()
  const r = await post('/api/bookings', {
    type: 'wisata', customerName: 'Uji Aula', customerPhone: hpC1, customerEmail: 'uji@arena.test',
    bookingDate: D, timeStart: '07:00', timeEnd: '10:00', participantCount: 20,
    rentalChairQuantity: 2, rentalSoundSystem: true, rentalMatQuantity: 1,
    items: [{ id: 'aula-full', name: 'Aula Full', category: 'tempat-pertemuan', quantity: 1, price: hargaAula }],
  })
  check('POST sewa aula-full 07-10 = 200', r.status === 200, JSON.stringify(r.body))
  if (r.status === 200) {
    created.push({ id: r.body.bookingId, phone: hpC1 })
    const { data: rentals } = await sb.from('rental_bookings').select('status').eq('booking_id', r.body.bookingId)
    check('rental status=hold saat pending', (rentals || []).length === 1 && rentals[0].status === 'hold', JSON.stringify((rentals || []).map((x) => x.status)))
    const pub = await get(`/api/invoice/${r.body.bookingId}?phone=${hpC1}`)
    check('invoice publik (tanpa admin) → 409 hingga lunas', pub.status === 409, `${pub.status} ${pub.body?.error || ''}`)
    const inv = await invoiceOf(r.body.bookingId, hpC1)
    const items = typeof inv.body.items === 'string' ? JSON.parse(inv.body.items) : inv.body.items
    check('invoice total == 3 jam × harga + addons', inv.body.total_amount === expected, `expected ${expected} got ${inv.body.total_amount}`)
    const addonIds = (items || []).map((i) => i.id).filter((i) => i && i.startsWith('rental-addon'))
    check('invoice memuat add-on server', addonIds.length === 3, JSON.stringify(addonIds))

    // Hold mengunci slot sejak pending (migrasi 020): booking kedua ditolak 409.
    const hpC2 = phone()
    const rHold = await post('/api/bookings', {
      type: 'wisata', customerName: 'Uji Hold', customerPhone: hpC2,
      bookingDate: D, timeStart: '08:00', timeEnd: '09:00', participantCount: 5,
      items: [{ id: 'aula-full', name: 'Aula Full', category: 'tempat-pertemuan', quantity: 1, price: hargaAula }],
    })
    check('double-book slot sama saat pending → 409 (hold ikut kunci)', rHold.status === 409 && /sudah dibooking/.test(rHold.body?.error || ''), `${rHold.status} ${rHold.body?.error || ''}`)

    // Simulasi pembayaran pertama: sync trigger menyalakan rental → slot terkunci.
    await sb.from('bookings').update({ status: 'confirmed', payment_status: 'paid' }).eq('id', r.body.bookingId)
    const { data: rentalsPaid } = await sb.from('rental_bookings').select('status').eq('booking_id', r.body.bookingId)
    check('rental status=active setelah paid (sync trigger)', (rentalsPaid || []).length === 1 && rentalsPaid[0].status === 'active', JSON.stringify((rentalsPaid || []).map((x) => x.status)))
    const r409 = await post('/api/bookings', {
      type: 'wisata', customerName: 'Uji Konflik', customerPhone: phone(),
      bookingDate: D, timeStart: '08:30', timeEnd: '09:30', participantCount: 5,
      items: [{ id: 'aula-full', name: 'Aula Full', category: 'tempat-pertemuan', quantity: 1, price: hargaAula }],
    })
    check('slot terkunci setelah paid → 409 + sudah dibooking', r409.status === 409 && /sudah dibooking/.test(r409.body.error || ''), `${r409.status} ${r409.body.error}`)

    // Slot dilepas saat booking di-cancel (kembalikan pending dulu supaya bisa cancel).
    await sb.from('bookings').update({ status: 'pending', payment_status: 'unpaid' }).eq('id', r.body.bookingId)
    const cancelOk = await cancelBooking(r.body.bookingId, hpC1)
    check('cancel pending → slot dilepas', cancelOk)
    const idxA = created.findIndex((c) => c.id === r.body.bookingId)
    if (idxA >= 0) created.splice(idxA, 1)
    const hpRe = phone()
    const rRe = await post('/api/bookings', {
      type: 'wisata', customerName: 'Uji Rebook', customerPhone: hpRe,
      bookingDate: D, timeStart: '08:30', timeEnd: '09:30', participantCount: 5,
      items: [{ id: 'aula-full', name: 'Aula Full', category: 'tempat-pertemuan', quantity: 1, price: hargaAula }],
    })
    check('slot lepas setelah cancel → 200', rRe.status === 200, `${rRe.status} ${rRe.body?.error || ''}`)
    if (rRe.status === 200) created.push({ id: rRe.body.bookingId, phone: hpRe })

    // Slot dilepas saat hold kedaluwarsa (15 menit): set expires_at ke masa lalu + sweep.
    const hpEx = phone()
    const rEx = await post('/api/bookings', {
      type: 'wisata', customerName: 'Uji Expire', customerPhone: hpEx,
      bookingDate: D, timeStart: '09:30', timeEnd: '10:30', participantCount: 5,
      items: [{ id: 'aula-full', name: 'Aula Full', category: 'tempat-pertemuan', quantity: 1, price: hargaAula }],
    })
    if (rEx.status === 200) {
      await sb.from('bookings').update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq('id', rEx.body.bookingId)
      await sb.rpc('expire_stale_booking_holds')
      const hpFr = phone()
      const rFr = await post('/api/bookings', {
        type: 'wisata', customerName: 'Uji Freed', customerPhone: hpFr,
        bookingDate: D, timeStart: '09:30', timeEnd: '10:30', participantCount: 5,
        items: [{ id: 'aula-full', name: 'Aula Full', category: 'tempat-pertemuan', quantity: 1, price: hargaAula }],
      })
      check('slot lepas setelah hold expired → 200', rFr.status === 200, `${rFr.status} ${rFr.body?.error || ''}`)
      if (rFr.status === 200) created.push({ id: rFr.body.bookingId, phone: hpFr })
    }

    const hpGz = phone()
    const rFree = await post('/api/bookings', {
      type: 'wisata', customerName: 'Uji Gazebo', customerPhone: hpGz,
      bookingDate: D, timeStart: '07:00', timeEnd: '08:00', participantCount: 5,
      items: [{ id: 'gazebo-atas', name: 'Gazebo Atas', category: 'area-kegiatan', quantity: 1, price: 30000 }],
    })
    check('venue lain di hari yang sama → 200', rFree.status === 200, `${rFree.status} ${rFree.body?.error || ''}`)
    if (rFree.status === 200) { created.push({ id: rFree.body.bookingId, phone: hpGz }) }
    const fullDay = await sb.from('rental_bookings').select('item_id,booking_date').eq('booking_date', '2026-10-18').is('time_start', null).neq('status', 'cancelled').limit(1)
    if (fullDay.data && fullDay.data[0]) {
      const r409Full = await post('/api/bookings', {
        type: 'wisata', customerName: 'Uji FullDay', customerPhone: phone(),
        bookingDate: fullDay.data[0].booking_date, timeStart: '07:00', timeEnd: '08:00', participantCount: 5,
        items: [{ id: fullDay.data[0].item_id, name: 'item-full-day', category: 'tempat-pertemuan', quantity: 1, price: 100000 }],
      })
      check('hari ber-event full-day → ditolak (409)', r409Full.status === 409, `${r409Full.status} ${r409Full.body?.error || ''}`)
    } else { console.log('  (skipped) tidak ada baris full-day masa depan utk dites') }
    const sn = typeof r.body.snapToken === 'string' && r.body.snapToken.length > 0
    check('snapToken Midtrans sandbox dihasilkan', sn)
  }
}

console.log('\n== D. Wisata (non-stay) ==')
{
  const hpD = phone()
  const r = await post('/api/bookings', {
    type: 'wisata', customerName: 'Uji ATV', customerPhone: hpD,
    bookingDate: daysFromNow(1), timeStart: '10:00', timeEnd: '11:00', participantCount: 2,
    items: [{ id: 'atv-anak', name: 'ATV Anak', category: 'aktivitas', quantity: 1, price: 5000 }],
  })
  check('POST ATV anak → 200', r.status === 200, `${r.status} ${r.body?.error || ''}`)
  if (r.status === 200) {
    created.push({ id: r.body.bookingId, phone: hpD })
    const inv = await invoiceOf(r.body.bookingId, hpD)
    check('invoice ATV == 5000', inv.body.total_amount === 5000, `got ${inv.body.total_amount}`)
  }
}

console.log('\n== E. Homestay (penginapan) ==')
{
  const inD = daysFromNow(3)
  const outD = daysFromNow(5)
  const { body: tp } = await get('/api/tour-packages?category=homestay')
  const aren = (tp || []).find((x) => x.id === 'aren-1')
  const { data: holidays } = await sb.from('booking_holiday_dates').select('holiday_date').eq('active', true).gte('holiday_date', inD).lt('holiday_date', outD)
  const holidayDates = (holidays || []).map((h) => h.holiday_date)
  const nights = 2
  const base = calculateHomestayBase(inD, outD, aren.price, aren.rate_options, holidayDates)
  const extraGuest = calculateExtraGuestTotal('aren-1', 7, nights, settings)
  const expected = base.baseTotal + extraGuest + 25000
  const hpE = phone()
  const form = new FormData()
  form.set('type', 'wisata')
  form.set('customerName', 'Uji Homestay')
  form.set('customerPhone', hpE)
  form.set('customerAddress', 'Jl Uji 1')
  form.set('items', JSON.stringify([{ id: 'aren-1', name: 'Aren 1', category: 'homestay', quantity: 1, price: aren.price }]))
  form.set('checkInDate', inD)
  form.set('checkOutDate', outD)
  form.set('guestCount', '7')
  form.set('documentType', 'ktp')
  form.set('extraBedQuantity', '1')
  form.set('identityDocument', new Blob([Buffer.from(JPEG_1PX, 'hex')], { type: 'image/jpeg' }), 'id.jpg')
  const r = await postForm('/api/bookings', form)
  check('POST homestay 2 malam + 2 tamu tambahan + extra bed → 200', r.status === 200, `${r.status} ${r.body?.error || ''}`)
  if (r.status === 200) {
    created.push({ id: r.body.bookingId, phone: hpE })
    const inv = await invoiceOf(r.body.bookingId, hpE)
    check('invoice homestay == FE/shared-utils', inv.body.total_amount === expected, `expected ${expected} got ${inv.body.total_amount} (base ${base.baseTotal} guest ${extraGuest})`)
    const { data: b } = await sb.from('bookings').select('document_storage_path,accommodation_type,nights,guest_count').eq('id', r.body.bookingId).single()
    check('accommodation tersimpan benar', b.accommodation_type === 'homestay' && b.nights === 2 && b.guest_count === 7, JSON.stringify(b))
    if (b.document_storage_path) {
      await sb.storage.from('booking-documents').remove([b.document_storage_path]).catch(() => null)
    }
  }
}

console.log('\n== F. Camping (sewa tenda sendiri + add-on) ==')
{
  const inD = daysFromNow(4)
  const outD = daysFromNow(6)
  const camping = calculateCampingTotal(
    { tentSize: 'small', tentCount: 1, tentOption: 'own', nights: 2, firewoodPackages: 1, nestingQuantity: 0, chairQuantity: 2 },
    settings,
  )
  const hpF = phone()
  const form = new FormData()
  form.set('type', 'wisata')
  form.set('customerName', 'Uji Camping')
  form.set('customerPhone', hpF)
  form.set('customerAddress', 'Jl Uji 2')
  form.set('items', JSON.stringify([{ id: 'camping-ground', name: 'Camping Ground', category: 'camping', quantity: 1, price: 0 }]))
  form.set('checkInDate', inD)
  form.set('checkOutDate', outD)
  form.set('guestCount', '4')
  form.set('documentType', 'ktp')
  form.set('tentSize', 'small')
  form.set('tentCount', '1')
  form.set('tentOption', 'own')
  form.set('firewoodPackages', '1')
  form.set('chairQuantity', '2')
  form.set('identityDocument', new Blob([Buffer.from(JPEG_1PX, 'hex')], { type: 'image/jpeg' }), 'id.jpg')
  const r = await postForm('/api/bookings', form)
  check('POST camping 2 malam + kayu bakar + kursi → 200', r.status === 200, `${r.status} ${r.body?.error || ''}`)
  if (r.status === 200) {
    created.push({ id: r.body.bookingId, phone: hpF })
    const inv = await invoiceOf(r.body.bookingId, hpF)
    check('invoice camping == FE/shared-utils', inv.body.total_amount === camping.total, `expected ${camping.total} got ${inv.body.total_amount}`)
    const { data: b } = await sb.from('bookings').select('document_storage_path').eq('id', r.body.bookingId).single()
    if (b.document_storage_path) await sb.storage.from('booking-documents').remove([b.document_storage_path]).catch(() => null)
  }
}

console.log('\n== G. Glamping (harga belum ditetapkan) ==')
{
  const hpG = phone()
  const form = new FormData()
  form.set('type', 'wisata')
  form.set('customerName', 'Uji Glamping')
  form.set('customerPhone', hpG)
  form.set('customerAddress', 'Jl Uji 3')
  form.set('items', JSON.stringify([{ id: 'glamping', name: 'Glamping', category: 'glamping', quantity: 1, price: null }]))
  form.set('checkInDate', daysFromNow(5))
  form.set('checkOutDate', daysFromNow(6))
  form.set('guestCount', '2')
  form.set('documentType', 'ktp')
  form.set('identityDocument', new Blob([Buffer.from(JPEG_1PX, 'hex')], { type: 'image/jpeg' }), 'id.jpg')
  const r = await postForm('/api/bookings', form)
  check('glamping tanpa harga → 409 jelas', r.status === 409 && /Glamping/i.test(r.body?.error || ''), `${r.status} ${r.body?.error || ''}`)
}

console.log('\n== H. Toko ==')
{
  const { body: prod } = await get('/api/products?available=true')
  const item = (prod || []).find((p) => p.price && p.price > 0 && p.purchasable !== false)
  if (item) {
    const hpH = phone()
    const r = await post('/api/bookings', {
      type: 'toko', customerName: 'Uji Toko', customerPhone: hpH,
      items: [{ id: item.id, name: item.name, category: item.category, quantity: 2, price: item.price }],
    })
    check(`POST toko (${item.id}) → 200`, r.status === 200, `${r.status} ${r.body?.error || ''}`)
    if (r.status === 200) {
      created.push({ id: r.body.bookingId, phone: hpH })
      const inv = await invoiceOf(r.body.bookingId, hpH)
      check('invoice toko == 2 × harga produk', inv.body.total_amount === item.price * 2, `expected ${item.price * 2} got ${inv.body.total_amount}`)
    }
  } else { console.log('  (skipped) tidak ada produk berharga tetap') }
}

console.log('\n== I. Pembatalan (cascade) ==')
{
  for (const c of created) {
    const ok = await cancelBooking(c.id, c.phone)
    const { data: rentals } = await sb.from('rental_bookings').select('status').eq('booking_id', c.id)
    const allCancelled = (rentals || []).every((r) => r.status === 'cancelled')
    const { data: bk } = await sb.from('bookings').select('status').eq('id', c.id).single()
    check(`cancel ${c.id} → confirmed di booking api + cascade rental (${rentals?.length || 0} baris)`, ok && bk?.status === 'cancelled' && allCancelled, `ok=${ok} status=${bk?.status} rentals=${JSON.stringify((rentals || []).map((r) => r.status))}`)
  }
  const { data: left } = await sb.from('bookings').select('id').eq('status', 'pending')
  check('tidak ada booking pending tersisa dari uji ini', (left || []).length === 0, `sisa ${(left || []).length}`)
}

console.log(`\n========== RINGKASAN: ${checks.pass} lulus, ${checks.fail} gagal ==========`)
process.exit(checks.fail ? 1 : 0)