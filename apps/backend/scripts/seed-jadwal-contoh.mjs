#!/usr/bin/env node
// Data contoh sementara untuk mengecek tampilan /admin/jadwal (tab Penginapan & Camping,
// tab Eduwisata & Kegiatan) saat belum ada booking nyata. Semua baris ber-customer_name
// "CONTOH-...", status confirmed + payment_status paid sehingga tampil sebagai jadwal aktif
// (sesuai invariant: jadwal = status lunas/confirmed).
//
// Penggunaan:
//   node apps/backend/scripts/seed-jadwal-contoh.mjs            # buat data contoh
//   node apps/backend/scripts/seed-jadwal-contoh.mjs --hapus    # hapus semua data CONTOH-
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HAPUS = process.argv.includes('--hapus')

const env = Object.fromEntries(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const TAG = 'CONTOH-'

function datePlus(days) {
  const d = new Date(Date.now() + days * 86400000)
  return d.toISOString().slice(0, 10)
}

function randSuffix() {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

async function findBookingIds() {
  const { data } = await sb.from('bookings').select('id').ilike('customer_name', `${TAG}%`)
  return (data || []).map((r) => r.id)
}

async function hapus() {
  const ids = await findBookingIds()
  if (ids.length === 0) { console.log('Tidak ada data contoh (sudah bersih).'); return }
  for (const table of ['rental_bookings', 'accommodation_bookings', 'edu_trip_reservations']) {
    const { error } = await sb.from(table).delete().in('booking_id', ids)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  const { error } = await sb.from('bookings').delete().in('id', ids)
  if (error) throw new Error(`bookings: ${error.message}`)
  console.log(`Dihapus ${ids.length} booking contoh (${ids.join(', ')}).`)
}

function bookingRow({
  short, itemId, itemName, category, price, quantity = 1,
  total, type = 'wisata', bookingDate = null, guestCount = null, bookingMode = 'standard',
}) {
  const now = new Date().toISOString()
  const id = `${TAG}${Date.now()}-${randSuffix()}`
  return {
    row: {
      id,
      type,
      booking_code: `CONTOH-${randSuffix()}`,
      customer_name: `${TAG}${short}`,
      customer_phone: '08123456' + String(Math.floor(1000 + Math.random() * 9000)),
      booking_date: bookingDate,
      items: [{ id: itemId, name: itemName, category, quantity, price }],
      total_amount: total,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'offline',
      notes: 'Data contoh untuk cek jadwal admin — hapus dengan: node seed-jadwal-contoh.mjs --hapus',
      expires_at: null,
      booking_mode: bookingMode,
      guest_count: guestCount,
      created_at: now,
      updated_at: now,
    },
    id,
  }
}

async function main() {
  if (HAPUS) { await hapus(); return }

  const dates = {
    homestayIn: datePlus(18),
    homestayOut: datePlus(20),
    campingIn: datePlus(21),
    campingOut: datePlus(23),
    eduDate: datePlus(25),
  }

  const { data: eduPackages } = await sb
    .from('tour_packages')
    .select('id, name, price')
    .in('category', ['paket-edukasi', 'paket-kegiatan'])
    .limit(1)
  const edu = eduPackages?.[0]
  if (!edu) throw new Error('Paket eduwisata (paket-edukasi/paket-kegiatan) tidak ditemukan di tour_packages.')

  // Cek tabrakan slot penginapan sebelum menulis.
  const { data: overlap } = await sb
    .from('accommodation_bookings')
    .select('id, item_id, check_in_date, check_out_date, status')
    .in('status', ['hold', 'active'])
    .or(`and(check_in_date.lte.${dates.homestayOut},check_out_date.gt.${dates.homestayIn}),and(check_in_date.lte.${dates.campingOut},check_out_date.gt.${dates.campingIn})`)
  if (overlap && overlap.length > 0) {
    console.log('Tanggal contoh berbenturan dengan booking lain. Jalankan lagi beberapa hari lain, atau hapus dulu booking berikut:')
    for (const o of overlap) console.log(`  - ${o.item_id}: ${o.check_in_date} → ${o.check_out_date} (${o.status})`)
    return
  }

  const now = new Date().toISOString()
  const bookings = []
  const accommodations = []
  const eduRows = []

  // 1. Homestay — Aren 1 (2 malam)
  const h = bookingRow({
    short: 'Homestay Aren 1', itemId: 'aren-1', itemName: 'Aren 1 (2-5 org)',
    category: 'homestay', price: 200000, total: 400000, type: 'sewa', guestCount: 4,
  })
  bookings.push(h.row)
  accommodations.push({
    id: `${h.id}-acc`, booking_id: h.id, item_id: 'aren-1', item_name: 'Aren 1 (2-5 org)',
    accommodation_type: 'homestay', check_in_date: dates.homestayIn, check_out_date: dates.homestayOut,
    nights: 2, guest_count: 4, nightly_price: 200000, extra_guest_fee: 0, addons: [],
    total_price: 400000, status: 'active', created_at: now, updated_at: now,
  })

  // 2. Camping — Camping Ground (2 malam, tenda sendiri)
  const c = bookingRow({
    short: 'Camping Family', itemId: 'camping-ground', itemName: 'Camping Ground',
    category: 'camping', price: 20000, total: 40000, type: 'sewa', guestCount: 3,
  })
  bookings.push(c.row)
  accommodations.push({
    id: `${c.id}-acc`, booking_id: c.id, item_id: 'camping-ground', item_name: 'Camping Ground',
    accommodation_type: 'camping', check_in_date: dates.campingIn, check_out_date: dates.campingOut,
    nights: 2, guest_count: 3, tent_size: 'small', tent_count: 1, tent_option: 'own',
    nightly_price: 20000, extra_guest_fee: 0, addons: [],
    total_price: 40000, status: 'active', created_at: now, updated_at: now,
  })

  // 3. Eduwisata — 1 rombongan kuota (paket eduwisata pertama dari katalog)
  const e = bookingRow({
    short: 'Eduwisata Contoh', itemId: edu.id, itemName: edu.name,
    category: edu.category || 'paket-edukasi', price: edu.price, quantity: 30,
    total: edu.price * 30, bookingDate: dates.eduDate, guestCount: 30, bookingMode: 'edu_trip',
  })
  bookings.push(e.row)
  eduRows.push({
    id: `${e.id}-edu`, booking_id: e.id, booking_date: dates.eduDate, status: 'active',
    created_at: now, updated_at: now,
  })

  const { error: insErr } = await sb.from('bookings').insert(bookings)
  if (insErr) throw new Error(`bookings: ${insErr.message}`)
  const { error: accErr } = await sb.from('accommodation_bookings').insert(accommodations)
  if (accErr) throw new Error(`accommodation_bookings: ${accErr.message}`)
  const { error: eduErr } = await sb.from('edu_trip_reservations').insert(eduRows)
  if (eduErr) throw new Error(`edu_trip_reservations: ${eduErr.message}`)

  console.log('Data contoh dibuat:')
  console.log(`  - Homestay Aren 1 : ${dates.homestayIn} → ${dates.homestayOut} (${h.row.booking_code})`)
  console.log(`  - Camping Ground  : ${dates.campingIn} → ${dates.campingOut} (${c.row.booking_code})`)
  console.log(`  - Eduwisata       : ${dates.eduDate} — ${edu.name} (${e.row.booking_code})`)
  console.log('Buka /admin/jadwal → filter bulan ini. Hapus lagi: node apps/backend/scripts/seed-jadwal-contoh.mjs --hapus')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})