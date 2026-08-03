#!/usr/bin/env node
// Import jadwal sewa tempat dari export HTML Google Sheets ke database.
// Sumber: /home/kresna/Downloads/JADWAL SEWA TEMPAT 2026/<BULAN>.html (tiap file = 1 tab bulan).
// Repeatable: setiap jalan, semua booking ber-prefix "SPR-" dihapus lalu diimpor ulang (clean replace).
// Gunakan: node apps/backend/scripts/import-jadwal.cjs [--dry|--check] [DIR]
//   --dry   : parse saja, tidak menulis DB
//   --check : parse + assert hitungan (EXPECTED_ROWS), exit 0/1 — tanpa menulis DB
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const DIR = process.argv.filter((a, i) => i > 1 && !a.startsWith('--'))[0]
  || '/home/kresna/Downloads/JADWAL SEWA TEMPAT 2026'
const DRY = process.argv.includes('--dry')
const CHECK = process.argv.includes('--check')

const MONTHS = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER']

// Hitungan baris data per bulan (hasil terverifikasi saat impor perdana 2026).
// Ponytail: berubah saat pengelola mengisi bulan baru — bump map ini (lihat runbook AGENTS.md).
const EXPECTED_ROWS = {
  JANUARI: 67, FEBRUARI: 43, MARET: 20, APRIL: 85, MEI: 103, JUNI: 107,
  JULI: 82, AGUSTUS: 22, SEPTEMBER: 5, OKTOBER: 1, NOVEMBER: 0, DESEMBER: 0,
}
const EXPECTED_TOTAL = Object.values(EXPECTED_ROWS).reduce((a, b) => a + b, 0)

// Penanda baris EDU (outing/edutrip) → selain rental, di-insert juga ke edu_trip_reservations
// agar kuota Edu Trip online tahu hari itu sudah ada grup.
const EDU_MARK = /edutrip|outing\s?class|outing|study\s?tour|edtrip/i

// Tempat yang tidak ada di katalog inventory_rentals: slug + nama tampilan.
const EXTRA_PLACES = {
  'area dukoh': ['area-dukoh', 'Area Dukoh'],
  'area parkir': ['area-parkir', 'Area Parkir'],
  'aula': ['aula', 'Aula'],
  'aula kaca': ['aula-kaca', 'Aula Kaca'],
  'balai dusun': ['balai-dusun', 'Balai Dusun'],
  'cah wahana dolan pacitan': ['cah-wahana-dolan-pacitan', 'Cah Wahana Dolan Pacitan'],
  'camp': ['camp-area', 'Camp Area'],
  'camp area': ['camp-area', 'Camp Area'],
  'area camp': ['camp-area', 'Camp Area'],
  'camp selatan': ['camp-area', 'Camp Area'],
  'gazebo': ['gazebo', 'Gazebo'],
  'gazebo warung': ['gazebo-warung', 'Gazebo Warung'],
  'senam': ['senam', 'Area Senam'],
  'teras': ['teras', 'Teras'],
}
// Sel TEMPAT gabungan yang ditulis manual: kunci normalize → daftar tempat.
const COMBO_SPLIT = {
  'area dukoh, senam': ['area dukoh', 'senam'],
  'joglo/pawon': ['joglo', 'pawon'],
  'camp/tutik': ['camp'],
  'water station/panggung': ['panggung'],
}
const PAYMENT_MARK = /lunas|tf\b|transfer|dp\b|cash|qris|bayar/i

function normalize(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/gasebo/gi, 'gazebo')
    .replace(/\bjglo\b/gi, 'joglo')
    .trim().replace(/\s+/g, ' ').toLowerCase()
}
function slug(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function titleCase(s) { return String(s).toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }
function digitsOnly(s) { return String(s || '').replace(/\D/g, '') }
// Typo di sheet: baris JANUARI ditulis 21/01/2025 & 25/01/2025 padahal maksudnya 2026.
const TYPO_YEAR_FIX = { '2025-01-21': '2026-01-21', '2025-01-25': '2026-01-25' }
function parseDate(s) {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const yy = y < 100 ? 2000 + y : y
  return `${yy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
// "08.00 - selesai" / "10-12.00" / "8-9" / "14.00/menginap" / "81353588227" / "full day" / "09-00-" / "25 orang, tikar 7"
function parseJam(raw) {
  let s = String(raw || '').replace(/\u00a0/g, ' ').trim().toLowerCase()
    .replace(/oo/g, '00').replace(/,\s*/g, '.').replace(/\.\s+/g, '.')
  if (!s || /^[-/]+$/.test(s)) return {}
  const returned = /selesai/.test(s)
  const hadDash = /-/.test(s)
  s = s.replace(/-?\s*selesai/g, ' ').trim()
  const r = {}
  const t = []
  for (const m of s.matchAll(/(\d{1,2})[.:](\d{2})/g)) {
    const h = Number(m[1]), mi = Number(m[2])
    if (h <= 23 && mi <= 59) t.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`)
  }
  const bare = (s.match(/(\d{1,2})(?=[-\s/]|$)/g) || []).map(Number).filter(h => h >= 6 && h <= 22)
  if (bare.length >= 2) {
    r.start = `${String(bare[0]).padStart(2, '0')}:00`
    r.end = `${String(bare[1]).padStart(2, '0')}:00`
  } else if (bare.length === 1 && t.length >= 1 && hadDash) {
    r.start = `${String(bare[0]).padStart(2, '0')}:00`
    r.end = t[0]
  } else if (bare.length === 1 && t.length === 0 && hadDash) {
    r.start = `${String(bare[0]).padStart(2, '0')}:00`
  } else if (t.length >= 1) {
    r.start = t[0]
    if (t[1]) r.end = t[1]
  }
  if (returned) r.returned = true
  return r
}

function parseHtml(file) {
  const html = fs.readFileSync(file, 'utf8')
  const rows = []
  for (const tr of (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [])) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m =>
      m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
    )
    if (cells.some(c => c)) rows.push(cells.slice(0, 8))
  }
  return rows
}

// Resolve satu sel TEMPAT → [{item_id, item_name}] (bisa lebih dari satu tempat).
function resolveVenue(raw, catalog) {
  const norm = normalize(raw)
  if (!norm || norm === 'tempat') return []
  const parts = COMBO_SPLIT[norm] || norm.split(',')
  const out = []
  for (let p of parts) {
    p = p.trim()
    if (!p) continue
    const n = normalize(p)
    const exact = catalog.find(c => c.key === n)
    const exactExtra = EXTRA_PLACES[n]
    let item = null
    if (exact) item = { item_id: exact.id, item_name: exact.name }
    else if (exactExtra) item = { item_id: exactExtra[0], item_name: exactExtra[1] }
    else {
      const catCont = catalog.filter(c => n.includes(c.key)).sort((a, b) => b.key.length - a.key.length)[0]
      const extraKeys = Object.keys(EXTRA_PLACES).filter(k => n.includes(k)).sort((a, b) => b.length - a.length)[0]
      if (catCont) item = { item_id: catCont.id, item_name: catCont.name }
      else if (extraKeys) item = { item_id: EXTRA_PLACES[extraKeys][0], item_name: EXTRA_PLACES[extraKeys][1] }
      else item = { item_id: slug(n), item_name: titleCase(p) }
    }
    if (!out.some(o => o.item_id === item.item_id)) out.push(item)
  }
  return out
}

async function main() {
  const env = Object.fromEntries(
    fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
      .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
  )
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: cat, error: catErr } = await sb.from('inventory_rentals').select('id,name')
  if (catErr) throw new Error(`catalog: ${catErr.message}`)
  const catalog = cat.map(c => ({ id: c.id, name: c.name, key: normalize(c.name) }))

  let total = 0
  const months = []
  const stats = { skips: 0, unresolvedVenues: new Set(), bookedRows: 0, returned: 0 }
  const skipLog = []
  const rows = []

  for (const m of MONTHS) {
    const file = path.join(DIR, `${m}.html`)
    if (!fs.existsSync(file)) { console.log(`SKIP ${m}: file tidak ada`); continue }
    const cells = parseHtml(file)
    let lastDate = null
    let lastVenue = null
    let monthRows = 0
    const monthData = []
    for (const r of cells) {
      if (r[0] && normalize(r[0]) === 'tanggal' || (r[3] && normalize(r[3]) === 'penyewa')) continue
      const date = parseDate(r[0])
      if (date) lastDate = TYPO_YEAR_FIX[date] || date
      const hasContent = r.slice(1, 8).some(c => String(c).trim())
      if (!lastDate && !hasContent) continue
      if (!date && !hasContent) continue
      if (String(r[1]).trim()) lastVenue = r[1]
      const row = { date: lastDate, tempat: String(r[1]).trim() || lastVenue, jam: r[2] || '', penyewa: r[3] || '', alamat: r[4] || '', keterangan: r[5] || '', hp: r[6] || '', pic: r[7] || '' }
      if (normalize(row.tempat) === 'tempat' && !row.penyewa && !row.jam) { stats.skips++; skipLog.push(`[${m}] header-garbage: ${JSON.stringify(r)}`); continue }
      if (!row.date) { stats.skips++; skipLog.push(`[${m}] tanpa tanggal: ${JSON.stringify(r)}`); continue }
      rows.push(row)
      monthData.push(row)
      monthRows++
    }
    months.push([m, monthRows])
    total += monthRows
    console.log(`${m}: ${monthRows} baris (dari ${cells.length - 1} baris HTML)`)
  }
  console.log(`TOTAL baris data valid: ${total}`)

  const bk = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const venues = resolveVenue(r.tempat, catalog)
    if (!venues.length) { stats.skips++; stats.unresolvedVenues.add(r.tempat); skipLog.push(`[${r.date}] tanpa tempat: ${JSON.stringify(r)}`); continue }
    const yyyy = r.date.slice(0, 4) + r.date.slice(5, 7)
    const seq = String(i + 1).padStart(4, '0')
    const code = `SPR-${yyyy}-${seq}`
    const phoneRaw = digitsOnly(r.hp)
    const phone = phoneRaw.length >= 9 ? phoneRaw : null
    const jamPhone = digitsOnly(r.jam)
    const shiftedPhone = !phone && jamPhone.length >= 9 ? jamPhone : null
    const jam = parseJam(shiftedPhone ? '' : r.jam)
    const paid = PAYMENT_MARK.test(r.keterangan || '')
    const edu = EDU_MARK.test(`${r.tempat} ${r.penyewa} ${r.keterangan}`)
    bk.push({
      code, date: r.date, venues, r, edu,
      customer_name: r.penyewa || venues[0].item_name, phone: shiftedPhone || phone,
      jam, paid, pic: r.pic || null,
    })
    if (jam.returned) stats.returned++
  }
  for (const v of stats.unresolvedVenues) console.log(`VENUE unresolved: ${JSON.stringify(v)}`)
  for (const s of skipLog) console.log(`SKIP ${s}`)
  console.log(`rows di-skip: ${stats.skips}, returned: ${stats.returned}`)
  console.log(`booking siap: ${bk.length}`)

  // Bangun semua baris dulu, cek overlap di JS (replika trigger DB: item+date sama,
  // interval bertabrakan, baris 'cancelled' tidak ikut menghalangi). Baris yang kalah
  // jadi 'cancelled' + jam null (ponytail: trigger DB tidak memeriksa NEW.status,
  // jadi baris cancelled ber-jam sama tetap ditolak; jam asli tersimpan di bookings).
  const bookingRows = []
  const rentalRows = []
  for (const b of bk) {
    bookingRows.push({
      id: b.code, type: 'sewa', booking_code: b.code,
      customer_name: b.customer_name, customer_phone: b.phone,
      customer_address: b.r.alamat || null, booking_date: b.date,
      time_start: b.jam.start || null, time_end: b.jam.end || null,
      items: b.venues.map(v => ({ item_id: v.item_id, item_name: v.item_name, quantity: 1 })),
      total_amount: 0, status: 'confirmed',
      payment_status: b.paid ? 'paid' : 'unpaid',
      notes: b.r.keterangan || null, expires_at: null, booking_mode: 'standard',
      assigned_pic: b.pic,
    })
    for (let v = 0; v < b.venues.length; v++) {
      const ven = b.venues[v]
      rentalRows.push({
        id: `${b.code}-${v + 1}`, booking_id: b.code,
        item_id: ven.item_id, item_name: ven.item_name, quantity: 1,
        booking_date: b.date, time_start: b.jam.start || null, time_end: b.jam.end || null,
        start_at: b.jam.start ? `${b.date}T${b.jam.start}:00+07:00` : `${b.date}T00:00:00+07:00`,
        end_at: b.jam.end ? `${b.date}T${b.jam.end}:00+07:00` : `${b.date}T23:59:00+07:00`,
        total_price: 0, status: b.jam.returned ? 'returned' : 'active',
      })
    }
  }
  const groups = new Map()
  for (const r of rentalRows) {
    const k = `${r.item_id}|${r.booking_date}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  const cancelled = []
  for (const list of groups.values()) {
    const kept = []
    for (const r of list) {
      if (!r.time_start) { kept.push(r); continue }
      const rEnd = r.time_end || r.time_start
      const conflict = kept.some(k => {
        if (!k.time_start) return false
        const kEnd = k.time_end || k.time_start
        return k.time_start < rEnd && kEnd > r.time_start
      })
      if (conflict) { r.status = 'cancelled'; r.time_start = null; r.time_end = null; cancelled.push(r) }
      else kept.push(r)
    }
  }
  for (const r of cancelled) console.log(`CANCELLED (double-book) ${r.booking_id} ${r.item_name} ${r.booking_date}`)

  // Baris EDU → selain rental sewa, juga tercatat di edu_trip_reservations (kuota online).
  // Booking utamanya tetap type 'sewa' — file ini hanya menambahkan entri kuota.
  const eduRows = bk.filter(b => b.edu).map(b => ({
    id: `${b.code}-EDU`, booking_id: b.code, booking_date: b.date, status: 'active',
  }))

  if (CHECK) {
    // Ponytail: returned/cancelled di bawah adalah patokan data terverifikasi (2026-07)
    // — bump bersama EXPECTED_ROWS saat sheet mulai berisi data baru (liat runbook AGENTS.md).
    const problems = []
    for (const [m, n] of months) {
      if (EXPECTED_ROWS[m] !== n) problems.push(`${m}: hitung ${n} ≠ expected ${EXPECTED_ROWS[m]}`)
    }
    if (total !== EXPECTED_TOTAL) problems.push(`total: ${total} ≠ ${EXPECTED_TOTAL}`)
    if (stats.skips !== 0) problems.push(`skip: ${stats.skips} baris`)
    if (stats.unresolvedVenues.size) problems.push(`venue unresolved: ${[...stats.unresolvedVenues].join(', ')}`)
    const returned = rentalRows.filter(r => r.status === 'returned').length
    if (returned !== 102) problems.push(`returned: ${returned} ≠ 102`)
    if (cancelled.length !== 3) problems.push(`cancelled double-book: ${cancelled.length} ≠ 3`)
    if (problems.length) {
      console.log('CHECK GAGAL:')
      for (const p of problems) console.log('  -', p)
      process.exit(1)
    }
    console.log(`CHECK PASS — ${total} baris, ${rentalRows.length} rental, ${returned} returned, ${cancelled.length} cancelled, ${eduRows.length} edu`)
    process.exit(0)
  }
  if (DRY) { console.log(`DRY RUN — tidak menulis DB (${eduRows.length} edu di-skip)`); return }

  // Hapus lama (clean replace) lalu insert dalam batch.
  const { error: delEdu } = await sb.from('edu_trip_reservations').delete().like('booking_id', 'SPR-%')
  if (delEdu) throw new Error(`hapus edu SPR lama: ${delEdu.message}`)
  const { error: delR } = await sb.from('rental_bookings').delete().like('booking_id', 'SPR-%')
  if (delR) throw new Error(`hapus rental SPR lama: ${delR.message}`)
  const { error: delErr } = await sb.from('bookings').delete().like('booking_code', 'SPR-%')
  if (delErr) throw new Error(`hapus SPR lama: ${delErr.message}`)

  let failed = 0
  for (let i = 0; i < bookingRows.length; i += 100) {
    const { error } = await sb.from('bookings').insert(bookingRows.slice(i, i + 100))
    if (error) { failed += bookingRows.slice(i, i + 100).length; console.log(`FAIL batch bookings @${i}: ${error.message}`) }
  }
  for (let i = 0; i < rentalRows.length; i += 100) {
    const { error } = await sb.from('rental_bookings').insert(rentalRows.slice(i, i + 100))
    if (error) { failed += rentalRows.slice(i, i + 100).length; console.log(`FAIL batch rentals @${i}: ${error.message}`) }
  }
  for (let i = 0; i < eduRows.length; i += 100) {
    const { error } = await sb.from('edu_trip_reservations').insert(eduRows.slice(i, i + 100))
    if (error) { failed += eduRows.slice(i, i + 100).length; console.log(`FAIL batch edu @${i}: ${error.message}`) }
  }
  console.log(`SELESAI. bookings: ${bookingRows.length}, rentals: ${rentalRows.length} (${cancelled.length} cancelled double-book), edu: ${eduRows.length}, error: ${failed}`)
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
