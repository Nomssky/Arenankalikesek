#!/usr/bin/env node
// Bersihkan sisa data uji E2E di database & storage (booking "Uji *"/"E2E*"/"CONTOH-*",
// dokumen identitas miliknya, upload blog tak terpakai, tabel attempt).
//
// Self-cleaning e2e memang hanya CANCEL (riwayat uji ditinggal), bukan DELETE —
// jadi baris cancelled menumpuk seiring waktu. Script ini merapikannya dan bisa
// dijalankan ulang kapan saja setelah sesi e2e.
//
// Penggunaan:
//   node apps/backend/scripts/bersihkan-e2e.mjs          # dry-run: tampilkan rencana
//   node apps/backend/scripts/bersihkan-e2e.mjs --ya     # backup ke /tmp lalu hapus
//
// Keamanan:
// - Dokumen identitas booking ASLI tidak pernah disentuh (hanya folder milik
//   booking target + folder yatim yang induknya sudah terhapus).
// - Upload blog-images hanya dihapus bila tidak dirujuk kolom image MAUPUN isi
//   markdown artikel.
// - admin_login_attempts/booking_create_attempts hanya baris > 1 hari agar
//   rate-limit/anti-duplikat yang sedang aktif tidak ikut ter-reset.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const YA = process.argv.includes('--ya')
const BATAS_ATTEMPT = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

function gagal(pesan) {
  console.error(`✗ ${pesan}`)
  process.exit(1)
}

// ---------- kumpulkan target ----------
// Pola nama/kode yang selalu dianggap data uji (termasuk varian lama:
// Conflict/e2e-sync/Tes Lock/Dbg).
const POLA_UJI = [
  'customer_name.like."E2E%"',
  'customer_name.like."Uji %"',
  'customer_name.like."CONTOH-%"',
  'customer_name.like."Conflict%"',
  'customer_name.like."e2e-sync-%"',
  'customer_name.like."Tes Lock%"',
  'customer_name.like."Dbg%"',
  'booking_code.like."E2E-%"',
]
const HAPUS_SEMUA_CANCELLED = process.argv.includes('--hapus-semua-cancelled')

async function ambilTargetBookings() {
  const { data, error } = await sb
    .from('bookings')
    .select('id, booking_code, customer_name, type, status, payment_status, created_at')
    .or(POLA_UJI.join(','))
  if (error) gagal(`Gagal membaca bookings: ${error.message}`)
  if (!HAPUS_SEMUA_CANCELLED) return data ?? []
  // Keputusan pemilik: sekali-sekali kosongkan SELURUH riwayat cancelled,
  // termasuk pembatalan manual orang asli (--hapus-semua-cancelled).
  const { data: batal, error: errBatal } = await sb
    .from('bookings')
    .select('id, booking_code, customer_name, type, status, payment_status, created_at')
    .eq('status', 'cancelled')
  if (errBatal) gagal(`Gagal membaca bookings cancelled: ${errBatal.message}`)
  return [...(data ?? []), ...(batal ?? [])]
}

const bookingsTarget = await ambilTargetBookings()
const terlihat = new Set()
const bookingsUnik = bookingsTarget.filter((b) =>
  terlihat.has(b.id) ? false : (terlihat.add(b.id), true),
)
const ids = bookingsUnik.map((b) => b.id)

async function hitungAnak(tabel) {
  if (ids.length === 0) return []
  const { data, error } = await sb.from(tabel).select('id').in('booking_id', ids)
  if (error) gagal(`Gagal membaca ${tabel}: ${error.message}`)
  return data
}

const rentalRows = await hitungAnak('rental_bookings') // TIDAK cascade → dihapus manual

// Daftar semua objek di bucket via Storage API (schema storage tidak terekspos
// lewat REST, jadi list rekursif per folder).
async function listSemua(bucket, prefix = '') {
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) gagal(`List ${bucket}: ${error.message}`)
  const out = []
  for (const item of data ?? []) {
    if (item.id === null) out.push(...(await listSemua(bucket, `${prefix}${item.name}/`)))
    else out.push(`${prefix}${item.name}`)
  }
  return out
}

// Dokumen identitas: folder milik target vs yatim vs milik asli (dipertahankan).
const semuaDokumen = await listSemua('booking-documents')
const idSet = new Set(ids)
const folderBooking = new Set()
const { data: semuaIdBookings } = await sb.from('bookings').select('id')
for (const b of semuaIdBookings ?? []) folderBooking.add(b.id)
const dokumenTarget = []
const dokumenYatim = []
let dokumenAsliTetap = 0
for (const nama of semuaDokumen) {
  const induk = nama.split('/')[0]
  if (idSet.has(induk)) dokumenTarget.push(nama)
  else if (!folderBooking.has(induk)) dokumenYatim.push(nama)
  else dokumenAsliTetap += 1
}

// Upload blog-images yang tidak dirujuk artikel mana pun.
const semuaGambarBlog = await listSemua('blog-images')
const { data: artikel } = await sb.from('blog_posts').select('image, content')
const rujukan = JSON.stringify(artikel ?? [])
const gambarTerpakai = (nama) => rujukan.includes(nama)
const gambarYatim = (semuaGambarBlog ?? []).map((g) => g.name).filter((n) => !gambarTerpakai(n))

// Kedua tabel attempt tidak punya kolom created_at (pakai updated_at /
// window_started_at) — error query count wajib dicek agar tidak diam-diam 0.
const { count: attemptLoginLama, error: errC1 } = await sb
  .from('admin_login_attempts')
  .select('id_key', { count: 'exact', head: true })
  .lt('updated_at', BATAS_ATTEMPT)
if (errC1) gagal(`Hitung admin_login_attempts: ${errC1.message}`)
const { count: attemptCreateLama, error: errC2 } = await sb
  .from('booking_create_attempts')
  .select('id_key', { count: 'exact', head: true })
  .lt('window_started_at', BATAS_ATTEMPT)
if (errC2) gagal(`Hitung booking_create_attempts: ${errC2.message}`)

// ---------- ringkasan ----------
console.log(`Rencana pembersihan data uji E2E${YA ? ' (MODE HAPUS)' : ' (dry-run)'}\n`)
console.log(`bookings (Uji*/E2E*/CONTOH-*)   : ${ids.length} baris`)
console.log(`rental_bookings terkait         : ${rentalRows.length} baris`)
console.log(`  (accommodation/edu/payments ikut CASCADE otomatis)`)
console.log(`dokumen booking-documents       : ${dokumenTarget.length} milik uji + ${dokumenYatim.length} yatim`)
console.log(`  (dokumen booking asli dipertahankan: ${dokumenAsliTetap})`)
console.log(`blog-images yatim               : ${gambarYatim.length} file`)
console.log(`admin_login_attempts > 1 hari   : ${attemptLoginLama ?? 0} baris`)
console.log(`booking_create_attempts > 1 hari: ${attemptCreateLama ?? 0} baris`)

if (!YA) {
  console.log('\nDry-run saja. Jalankan ulang dengan --ya untuk mengeksekusi.')
  process.exit(0)
}

// ---------- eksekusi ----------
const stempel = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = `/tmp/opencode/backup-e2e-${stempel}.json`
writeFileSync(
  backupPath,
  JSON.stringify({ bookingsTarget: bookingsUnik, rentalIds: rentalRows.map((r) => r.id), dokumenTarget, dokumenYatim, gambarYatim }, null, 2),
)
console.log(`\nBackup: ${backupPath}`)

// Remove kadang pulih tanpa error nyata (pernah terjadi di blog-images):
// verifikasi dengan list ulang, ulangi maksimal 3x sebelum gagalkan.
async function hapusStorage(bucket, names) {
  const sisa = new Set(names)
  for (let percobaan = 0; percobaan < 3 && sisa.size > 0; percobaan++) {
    const daftar = [...sisa]
    for (let i = 0; i < daftar.length; i += 50) {
      const { error } = await sb.storage.from(bucket).remove(daftar.slice(i, i + 50))
      if (error) gagal(`Hapus ${bucket}: ${error.message}`)
    }
    const masihAda = new Set(await listSemua(bucket))
    for (const n of daftar) if (!masihAda.has(n)) sisa.delete(n)
  }
  if (sisa.size > 0) gagal(`${bucket}: ${sisa.size} objek gagal terhapus: ${[...sisa].join(', ')}`)
}
await hapusStorage('booking-documents', [...dokumenTarget, ...dokumenYatim])
await hapusStorage('blog-images', gambarYatim)
console.log(`✓ Dokumen storage: ${dokumenTarget.length + dokumenYatim.length} + gambar blog: ${gambarYatim.length}`)

for (let i = 0; i < rentalRows.length; i += 100) {
  const potong = rentalRows.slice(i, i + 100).map((r) => r.id)
  const { error } = await sb.from('rental_bookings').delete().in('id', potong)
  if (error) gagal(`Hapus rental_bookings: ${error.message}`)
}
console.log(`✓ rental_bookings: ${rentalRows.length}`)

for (let i = 0; i < ids.length; i += 100) {
  // accommodation_bookings/edu_trip_reservations/payments ikut terhapus via CASCADE.
  const { error } = await sb.from('bookings').delete().in('id', ids.slice(i, i + 100))
  if (error) gagal(`Hapus bookings: ${error.message}`)
}
console.log(`✓ bookings (+ anak cascade): ${ids.length}`)

const { error: errLogin } = await sb.from('admin_login_attempts').delete().lt('updated_at', BATAS_ATTEMPT)
if (errLogin) gagal(`Kosongkan admin_login_attempts: ${errLogin.message}`)
const { error: errCreate } = await sb.from('booking_create_attempts').delete().lt('window_started_at', BATAS_ATTEMPT)
if (errCreate) gagal(`Kosongkan booking_create_attempts: ${errCreate.message}`)
console.log(`✓ attempts > 1 hari dikosongkan (${attemptLoginLama ?? 0} + ${attemptCreateLama ?? 0})`)

console.log('\nSelesai.')
