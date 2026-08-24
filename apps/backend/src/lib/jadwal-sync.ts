// Sinkronisasi jadwal dari Google Sheets (baca publik via gviz CSV) ke database.
//
// Prinsip (lihat docs/rencana-sync-spreadsheet.md):
// - Sheet HANYA dibaca; tidak ada mekanisme tulis balik ke Google.
// - Parser tahan perubahan: header dipetakan berdasar nama (fuzzy), kolom/tab
//   tak dikenal diabaikan, baris bermasalah dilewati + dilaporkan.
// - Fail-safe: hasil parse divalidasi kewarasannya SEBELUM data lama dihapus;
//   mencurigakan → seluruh sync dibatalkan dan data lama tetap tayang.
// - Kunci + throttle antar-instance memaksa satu sync pada satu waktu
//   memakai tabel booking_create_attempts (tanpa migration baru).

import type { SupabaseClient } from '@supabase/supabase-js'

export const SHEET_SEWA_DEFAULT = '1gzr2YDHUvJf-dy4lzzsH_jM4NcPbmCAmKRGzFG7tG_I'
export const SHEET_PENGINAPAN_DEFAULT = '1s6OGNLru3a6TpP7CtbgO4qR6wwdswl-hCylH1r2W7UQ'
const LOCK_KEY = 'jadwal-sync-lock'
const LOCK_JEDA_DETIK = 90

export const MONTH_TABS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
]

// Typo terverifikasi di sheet JANUARI: tahun ditulis 2025 padahal maksudnya 2026.
const TYPO_YEAR_FIX: Record<string, string> = {
  '2025-01-21': '2026-01-21',
  '2025-01-25': '2026-01-25',
}

const EDU_MARK = /edutrip|outing\s?class|outing|study\s?tour|edtrip/i
const PAYMENT_MARK = /lunas|tf\b|transfer|dp\b|cash|qris|bayar/i

const COMBO_SPLIT: Record<string, string[]> = {
  'area dukoh, senam': ['area dukoh', 'senam'],
  'joglo/pawon': ['joglo', 'pawon'],
  'camp/tutik': ['camp'],
  'water station/panggung': ['panggung'],
}

const EXTRA_PLACES: Record<string, [string, string]> = {
  'area dukoh': ['area-dukoh', 'Area Dukoh'],
  'area parkir': ['area-parkir', 'Area Parkir'],
  aula: ['aula', 'Aula'],
  'aula kaca': ['aula-kaca', 'Aula Kaca'],
  'balai dusun': ['balai-dusun', 'Balai Dusun'],
  'cah wahana dolan pacitan': ['cah-wahana-dolan-pacitan', 'Cah Wahana Dolan Pacitan'],
  camp: ['camp-area', 'Camp Area'],
  'camp area': ['camp-area', 'Camp Area'],
  'area camp': ['camp-area', 'Camp Area'],
  'camp selatan': ['camp-area', 'Camp Area'],
  gazebo: ['gazebo', 'Gazebo'],
  'gazebo warung': ['gazebo-warung', 'Gazebo Warung'],
  senam: ['senam', 'Area Senam'],
  teras: ['teras', 'Teras'],
}

// Pemetaan kolom UNIT sheet penginapan → item akomodasi web.
// Glamping 1 & 2 dua tenda fisik tapi satu item web 'glamping'.
const UNIT_MAP: Array<{ cocok: RegExp; itemId: string }> = [
  { cocok: /^aren[\s-]*[ _]?1$/i, itemId: 'aren-1' },
  { cocok: /^aren[\s-]*[ _]?2$/i, itemId: 'aren-2' },
  { cocok: /^aren[\s-]*[ _]?3$/i, itemId: 'aren-3' },
  { cocok: /^aren[\s-]*[ _]?4$/i, itemId: 'aren-4' },
  { cocok: /^camp(ing)?( ground| area)?$/i, itemId: 'camping-ground' },
  { cocok: /^glamping([\s-]*[12])?$/i, itemId: 'glamping' },
]
const ITEM_NAME_AKOMODASI: Record<string, string> = {
  'aren-1': 'Aren 1',
  'aren-2': 'Aren 2',
  'aren-3': 'Aren 3',
  'aren-4': 'Aren 4',
  'camping-ground': 'Camping Ground',
  glamping: 'Glamping',
}

// ---------- util teks ----------
export function normalize(s: unknown): string {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/gasebo/gi, 'gazebo')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}
function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function titleCase(s: string): string {
  return s.toLowerCase().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
function digitsOnly(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '')
}

// Tanggal dd/mm/yyyy — tahun 1–4 digit ditoleransi ("21/8/6" → 2026).
export function parseDateLenient(s: unknown): string | null {
  const m = String(s ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  let yyyy = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  // Tahun pendek: "26"→2026; satu digit seperti "21/8/6" adalah typo dari "26"
  // (kasus nyata di sheet) → petakan ke 202x.
  if (yyyy < 10) yyyy = 2020 + yyyy
  else if (yyyy < 100) yyyy += 2000
  if (yyyy < 2000 || yyyy > 2100) return null
  return `${yyyy}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Jam sangat longgar; aturan identik dengan scripts/import-jadwal.cjs.
export function parseJam(raw: unknown): { start?: string; end?: string; returned?: boolean } {
  let s = String(raw ?? '').replace(/\u00a0/g, ' ').trim().toLowerCase()
    .replace(/oo/g, '00').replace(/,\s*/g, '.').replace(/\.\s+/g, '.')
  if (!s || /^[-/]+$/.test(s)) return {}
  const returned = /selesai/.test(s)
  const hadDash = /-/.test(s)
  s = s.replace(/-?\s*selesai/g, ' ').trim()
  const r: { start?: string; end?: string; returned?: boolean } = {}
  const penuh: string[] = []
  for (const m of s.matchAll(/(\d{1,2})[.:](\d{2})/g)) {
    const h = Number(m[1])
    const mi = Number(m[2])
    if (h <= 23 && mi <= 59) penuh.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`)
  }
  const polos = (s.match(/(\d{1,2})(?=[-\s/]|$)/g) || []).map(Number).filter((h) => h >= 6 && h <= 22)
  if (polos.length >= 2) {
    r.start = `${String(polos[0]).padStart(2, '0')}:00`
    r.end = `${String(polos[1]).padStart(2, '0')}:00`
  } else if (polos.length === 1 && penuh.length >= 1 && hadDash) {
    r.start = `${String(polos[0]).padStart(2, '0')}:00`
    r.end = penuh[0]
  } else if (polos.length === 1 && penuh.length === 0 && hadDash) {
    r.start = `${String(polos[0]).padStart(2, '0')}:00`
  } else if (penuh.length >= 1) {
    r.start = penuh[0]
    if (penuh[1]) r.end = penuh[1]
  }
  if (returned) r.returned = true
  return r
}

// ---------- CSV ----------
// Parser RFC4180 mini: kutip ganda, koma/baris baru dalam kutip, "" sebagai kutip.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const hasil: string[][] = []
  let baris: string[] = []
  let sel = ''
  let dalamKutip = false
  let i = 0
  const tutupSel = () => { baris.push(sel); sel = '' }
  const tutupBaris = () => { tutupSel(); hasil.push(baris); baris = [] }
  while (i < src.length) {
    const c = src[i]
    if (dalamKutip) {
      if (c === '"') {
        if (src[i + 1] === '"') { sel += '"'; i += 2; continue }
        dalamKutip = false; i++; continue
      }
      sel += c; i++; continue
    }
    if (c === '"' && sel === '') { dalamKutip = true; i++; continue }
    if (c === ',') { tutupSel(); i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { tutupBaris(); i++; continue }
    sel += c; i++
  }
  if (sel !== '' || baris.length > 0) tutupBaris()
  return hasil.filter((r) => r.some((c) => c.trim() !== ''))
}

// ---------- pemetaan header ----------
type NamaKolom = 'tanggal' | 'tempat' | 'jam' | 'penyewa' | 'alamat' | 'keterangan' | 'hp' | 'pic' | 'dp' | 'chek_in' | 'chek_out'
type PetaKolom = Partial<Record<NamaKolom, number>>

const SINONIM_KOLOM: Record<string, NamaKolom> = {}
function daftarSinonim(nama: NamaKolom, sinonim: string[]): void {
  for (const s of sinonim) SINONIM_KOLOM[normalize(s)] = nama
}
daftarSinonim('tanggal', ['tanggal', 'tgl', 'date'])
daftarSinonim('tempat', ['tempat', 'venue', 'lokasi', 'unit', 'kamar'])
daftarSinonim('jam', ['jam', 'waktu', 'pukul'])
daftarSinonim('penyewa', ['penyewa', 'nama', 'customer', 'pemesan'])
daftarSinonim('alamat', ['alamat', 'asal'])
daftarSinonim('keterangan', ['keterangan', 'ket', 'catatan', 'note'])
daftarSinonim('hp', ['nomor hp', 'no hp', 'hp', 'nomor telepon', 'telepon', 'telp', 'wa', 'whatsapp'])
daftarSinonim('pic', ['pic', 'petugas'])
daftarSinonim('dp', ['dp'])
// Sheet penginapan: "CHEK IN" berisi nomor bed/tenda, "CHEK OUT" nama petugas
// (bukan tanggal!) — keduanya disimpan utuh sebagai catatan.
daftarSinonim('chek_in', ['chek in', 'check in', 'checkin'])
daftarSinonim('chek_out', ['chek out', 'check out', 'checkout'])

export function petakanKolom(header: string[]): PetaKolom | null {
  const peta: PetaKolom = {}
  header.forEach((sel, indeks) => {
    const kunci = SINONIM_KOLOM[normalize(sel)]
    if (kunci && peta[kunci] === undefined) peta[kunci] = indeks
  })
  return peta.tanggal !== undefined ? peta : null
}

// ---------- resolusi tempat/unit ----------
export interface Venue { item_id: string; item_name: string; key?: string }

export function resolveVenue(raw: unknown, catalog: Venue[]): Venue[] {
  const norm = normalize(raw)
  if (!norm || norm === 'tempat') return []
  const bagian = COMBO_SPLIT[norm] || norm.split(',')
  const out: Venue[] = []
  for (let p of bagian) {
    p = p.trim()
    if (!p) continue
    const n = normalize(p)
    let item: Venue | null = null
    const pasangan = catalog.find((c) => c.key === n)
    if (pasangan) item = { item_id: pasangan.item_id, item_name: pasangan.item_name }
    else if (EXTRA_PLACES[n]) item = { item_id: EXTRA_PLACES[n][0], item_name: EXTRA_PLACES[n][1] }
    else {
      const mengandung = catalog.filter((c) => n.includes(c.key ?? '')).sort((a, b) => (b.key?.length ?? 0) - (a.key?.length ?? 0))[0]
      const extraKunci = Object.keys(EXTRA_PLACES).filter((k) => n.includes(k)).sort((a, b) => b.length - a.length)[0]
      if (mengandung) item = { item_id: mengandung.item_id, item_name: mengandung.item_name }
      else if (extraKunci) item = { item_id: EXTRA_PLACES[extraKunci][0], item_name: EXTRA_PLACES[extraKunci][1] }
      else item = { item_id: slug(n), item_name: titleCase(p) }
    }
    if (item && !out.some((o) => o.item_id === item!.item_id)) out.push(item)
  }
  return out
}

export function mapUnitAkomodasi(raw: unknown): Venue | null {
  const n = normalize(raw)
  if (!n) return null
  const temuan = UNIT_MAP.find((u) => u.cocok.test(n))
  if (!temuan) return null
  return { item_id: temuan.itemId, item_name: ITEM_NAME_AKOMODASI[temuan.itemId] }
}

// ---------- ekstraksi baris dari tab ----------
export interface TabCsv { nama: string; csv: string }

interface BarisMentah {
  tanggal: string | null
  tempat: string
  jam: string
  penyewa: string
  alamat: string
  keterangan: string
  hp: string
  pic: string
  dp: string
  chek_in: string
  chek_out: string
}

function ekstrakBaris(tab: TabCsv): { baris: BarisMentah[]; masalah: string[] } {
  const cells = parseCsv(tab.csv)
  const masalah: string[] = []
  let indeksHeader = cells.findIndex((r) => petakanKolom(r) !== null)
  let kolom: PetaKolom | null = indeksHeader >= 0 ? petakanKolom(cells[indeksHeader]) : null
  // Fallback urutan kolom standar (TANGGAL,TEMPAT,JAM,PENYEWA,…): header di
  // sheet kadang rusak ketimpa isi (kasus nyata tab AGUSTUS: "b","00","0",…).
  if (!kolom && cells.length > 1 && cells[0].length >= 8 && cells.slice(1).some((r) => parseDateLenient(r[0]))) {
    indeksHeader = 0
    kolom = { tanggal: 0, tempat: 1, jam: 2, penyewa: 3, alamat: 4, keterangan: 5, hp: 6, pic: 7 }
    masalah.push(`[${tab.nama}] header rusak — diparse dengan urutan kolom standar`)
  }
  if (!kolom || indeksHeader === -1) return { baris: [], masalah: [`[${tab.nama}] header tidak dikenali`] }
  if (kolom.penyewa === undefined) masalah.push(`[${tab.nama}] kolom PENYEWA tidak ditemukan`)
  const ambil = (r: string[], k: NamaKolom): string =>
    kolom[k] === undefined ? '' : String(r[kolom[k] as number] ?? '').trim()
  const baris: BarisMentah[] = []
  let tanggalTerakhir: string | null = null
  let tempatTerakhir = ''
  for (const r of cells.slice(indeksHeader + 1)) {
    const tanggal = parseDateLenient(r[kolom.tanggal as number])
    if (tanggal) tanggalTerakhir = TYPO_YEAR_FIX[tanggal] || tanggal
    const tempatKini = ambil(r, 'tempat')
    if (tempatKini) tempatTerakhir = tempatKini
    const adaIsi = r.some((c) => String(c).trim() !== '')
    if (!tanggalTerakhir && !adaIsi) continue
    if (!tanggal && !adaIsi) continue
    baris.push({
      tanggal: tanggalTerakhir,
      tempat: tempatKini || tempatTerakhir,
      jam: ambil(r, 'jam'),
      penyewa: ambil(r, 'penyewa'),
      alamat: ambil(r, 'alamat'),
      keterangan: ambil(r, 'keterangan'),
      hp: ambil(r, 'hp'),
      pic: ambil(r, 'pic'),
      dp: ambil(r, 'dp'),
      chek_in: ambil(r, 'chek_in'),
      chek_out: ambil(r, 'chek_out'),
    })
  }
  return { baris, masalah }
}

// ---------- bangun data sewa tempat ----------
export interface RingkasanTab { nama: string; jumlah: number }

export interface HasilSewa {
  bookings: Record<string, unknown>[]
  rentals: Record<string, unknown>[]
  edu: Record<string, unknown>[]
  perTab: RingkasanTab[]
  masalah: string[]
}

interface BarisSewa extends BarisMentah {
  venues: Venue[]
  jamHasil: ReturnType<typeof parseJam>
  kode: string
}

export function bangunSewa(tabs: TabCsv[], catalog: Venue[]): HasilSewa {
  const bookings: Record<string, unknown>[] = []
  const rentals: Record<string, unknown>[] = []
  const edu: Record<string, unknown>[] = []
  const perTab: RingkasanTab[] = []
  const masalah: string[] = []
  const siap: BarisSewa[] = []

  for (const tab of tabs) {
    const { baris, masalah: m } = ekstrakBaris(tab)
    masalah.push(...m)
    let hitung = 0
    for (const b of baris) {
      // Baris sampel header-garbage / tanpa isi penting dilewati diam-diam.
      if (normalize(b.tempat) === 'tempat' && !b.penyewa && !b.jam) continue
      const venues = resolveVenue(b.tempat, catalog)
      if (!venues.length) {
        masalah.push(`[${tab.nama}] ${b.tanggal ?? '?'} tanpa tempat valid: "${b.tempat}" (${b.penyewa || '-'})`)
        continue
      }
      if (!b.tanggal || !b.penyewa.trim()) {
        masalah.push(`[${tab.nama}] baris dilewati (tanggal/penyewa kosong)`)
        continue
      }
      const yyyy = b.tanggal.slice(0, 4) + b.tanggal.slice(5, 7)
      const kode = `SPR-${yyyy}-${String(siap.length + 1).padStart(4, '0')}`
      const hpAngka = digitsOnly(b.hp)
      const jamAngka = digitsOnly(b.jam)
      const telepon = hpAngka.length >= 9 ? hpAngka : jamAngka.length >= 9 ? jamAngka : null
      // HP nyasar di kolom JAM dipindah ke telepon; JAM jadi kosong (aturan lama).
      const jamHasil = telepon && telepon === jamAngka && hpAngka.length < 9 ? parseJam('') : parseJam(b.jam)
      siap.push({ ...b, venues, jamHasil, kode })
      hitung++
    }
    perTab.push({ nama: tab.nama, jumlah: hitung })
  }

  for (const b of siap) {
    bookings.push({
      id: b.kode,
      type: 'sewa',
      booking_code: b.kode,
      customer_name: b.penyewa.trim() || b.venues[0].item_name,
      customer_phone: digitsOnly(b.hp).length >= 9 ? digitsOnly(b.hp) : (() => { const j = digitsOnly(b.jam); return j.length >= 9 ? j : null })(),
      customer_address: b.alamat.trim() || null,
      booking_date: b.tanggal,
      time_start: b.jamHasil.start || null,
      time_end: b.jamHasil.end || null,
      items: b.venues.map((v) => ({ item_id: v.item_id, item_name: v.item_name, quantity: 1 })),
      total_amount: 0,
      status: 'confirmed',
      payment_status: PAYMENT_MARK.test(b.keterangan) ? 'paid' : 'unpaid',
      notes: b.keterangan.trim() || null,
      expires_at: null,
      booking_mode: 'standard',
      assigned_pic: b.pic.trim() || null,
    })
    b.venues.forEach((v, idx) => {
      rentals.push({
        id: `${b.kode}-${idx + 1}`,
        booking_id: b.kode,
        item_id: v.item_id,
        item_name: v.item_name,
        quantity: 1,
        booking_date: b.tanggal,
        time_start: b.jamHasil.start || null,
        time_end: b.jamHasil.end || null,
        start_at: b.jamHasil.start ? `${b.tanggal}T${b.jamHasil.start}:00+07:00` : `${b.tanggal}T00:00:00+07:00`,
        end_at: b.jamHasil.end ? `${b.tanggal}T${b.jamHasil.end}:00+07:00` : `${b.tanggal}T23:59:00+07:00`,
        total_price: 0,
        status: b.jamHasil.returned ? 'returned' : 'active',
      })
    })
    if (EDU_MARK.test(`${b.tempat} ${b.penyewa} ${b.keterangan}`)) {
      edu.push({ id: `${b.kode}-EDU`, booking_id: b.kode, booking_date: b.tanggal, status: 'active' })
    }
  }

  // Replika trigger double-book (item+tanggal sama, interval bertabrakan):
  // yang kalah → cancelled + jam null (penjelasan lengkap ada di scripts/import-jadwal.cjs;
  // trigger DB mengecualikan status cancelled sehingga baris ini tetap lolos insert).
  const grup = new Map<string, typeof rentals>()
  for (const r of rentals) {
    const k = `${String(r.item_id)}|${String(r.booking_date)}`
    if (!grup.has(k)) grup.set(k, [])
    grup.get(k)!.push(r)
  }
  for (const daftar of grup.values()) {
    const disimpan: typeof rentals = []
    for (const r of daftar) {
      const mulai = r.time_start as string | null
      if (!mulai) { disimpan.push(r); continue }
      const selesai = (r.time_end as string | null) || mulai
      const bentrok = disimpan.some((k) => {
        const km = k.time_start as string | null
        if (!km) return false
        const ka = (k.time_end as string | null) || km
        return km < selesai && ka > mulai
      })
      if (bentrok) {
        r.status = 'cancelled'
        r.time_start = null
        r.time_end = null
      } else disimpan.push(r)
    }
  }

  return { bookings, rentals, edu, perTab, masalah }
}

// ---------- bangun data penginapan ----------
export function tambahSehari(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export interface HasilPenginapan {
  bookings: Record<string, unknown>[]
  akomodasi: Record<string, unknown>[]
  perTab: RingkasanTab[]
  masalah: string[]
}

export function bangunPenginapan(tabs: TabCsv[]): HasilPenginapan {
  const bookings: Record<string, unknown>[] = []
  const akomodasi: Record<string, unknown>[] = []
  const perTab: RingkasanTab[] = []
  const masalah: string[] = []
  const terisi = new Set<string>()

  for (const tab of tabs) {
    const { baris, masalah: m } = ekstrakBaris(tab)
    masalah.push(...m)
    let hitung = 0
    for (const b of baris) {
      if (!b.tanggal || !b.penyewa.trim()) continue
      const unit = mapUnitAkomodasi(b.tempat)
      if (!unit) {
        masalah.push(`[${tab.nama}] ${b.tanggal} unit tak dikenali: "${b.tempat}" (${b.penyewa})`)
        continue
      }
      const kunci = `${unit.item_id}|${b.tanggal}`
      if (terisi.has(kunci)) continue
      terisi.add(kunci)
      const yyyy = b.tanggal.slice(0, 4) + b.tanggal.slice(5, 7)
      const kode = `SPI-${yyyy}-${String(bookings.length + 1).padStart(4, '0')}`
      const bayar = PAYMENT_MARK.test(`${b.keterangan} ${b.dp}`)
      const petugas = [b.chek_out, b.pic].map((x) => x.trim()).filter(Boolean).join('/')
      const catatan = [
        b.keterangan,
        b.dp ? `DP: ${b.dp}` : '',
        `BED/TENDA: ${b.chek_in || b.jam || '-'}`,
        petugas ? `PETUGAS: ${petugas}` : '',
      ].map((x) => x.trim()).filter(Boolean).join(' | ')
      const hp = digitsOnly(b.hp)
      bookings.push({
        id: kode,
        type: 'wisata',
        booking_code: kode,
        booking_mode: 'stay',
        customer_name: b.penyewa.trim(),
        customer_phone: hp.length >= 9 ? hp : null,
        booking_date: b.tanggal,
        check_in_date: b.tanggal,
        check_out_date: tambahSehari(b.tanggal),
        nights: 1,
        total_amount: 0,
        status: 'confirmed',
        payment_status: bayar ? 'paid' : 'unpaid',
        notes: catatan || null,
        expires_at: null,
      })
      akomodasi.push({
        id: `${kode}-A`,
        booking_id: kode,
        item_id: unit.item_id,
        item_name: unit.item_name,
        accommodation_type: unit.item_id.startsWith('aren-') ? 'homestay' : unit.item_id === 'camping-ground' ? 'camping' : 'glamping',
        check_in_date: b.tanggal,
        check_out_date: tambahSehari(b.tanggal),
        nights: 1,
        guest_count: 1,
        total_price: 0,
        status: 'active',
      })
      hitung++
    }
    perTab.push({ nama: tab.nama, jumlah: hitung })
  }
  return { bookings, akomodasi, perTab, masalah }
}

// ---------- fetch gviz ----------
async function ambilTab(sheetId: string, tab: string): Promise<TabCsv | null> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const teks = await res.text()
    if (teks.trimStart().startsWith('<')) return null
    return { nama: tab, csv: teks }
  } catch {
    return null
  }
}

async function ambilSemuaTab(sheetId: string): Promise<TabCsv[]> {
  const hasil = await Promise.all(MONTH_TABS.map((t) => ambilTab(sheetId, t)))
  return hasil.filter((t): t is TabCsv => t !== null)
}

// ---------- kunci antar-instance ----------
type Db = SupabaseClient

async function cobaKunci(sb: Db): Promise<boolean> {
  const batas = new Date(Date.now() - LOCK_JEDA_DETIK * 1000).toISOString()
  const sekarang = new Date().toISOString()
  // Ambil lewat UPDATE kondisional (atomik lintas instance): hanya berhasil
  // bila kunci lama sudah lebih tua dari jeda minimum.
  const upd = await sb
    .from('booking_create_attempts')
    .update({ attempt_count: 1, window_started_at: sekarang, updated_at: sekarang })
    .eq('id_key', LOCK_KEY)
    .lt('window_started_at', batas)
    .select('id_key')
  if (!upd.error && Array.isArray(upd.data) && upd.data.length > 0) return true
  const ins = await sb
    .from('booking_create_attempts')
    .upsert([{ id_key: LOCK_KEY, attempt_count: 1, window_started_at: sekarang, updated_at: sekarang }], { onConflict: 'id_key', ignoreDuplicates: true })
    .select('id_key')
  return !ins.error && Array.isArray(ins.data) && ins.data.length > 0
}

async function lepasKunci(sb: Db): Promise<void> {
  await sb.from('booking_create_attempts').delete().eq('id_key', LOCK_KEY)
}

async function hitungPrefiks(sb: Db, prefiks: string): Promise<number> {
  const { count, error } = await sb
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .like('booking_code', `${prefiks}%`)
  if (error) throw new Error(`hitung ${prefiks}: ${error.message}`)
  return count ?? 0
}

async function hapusDataSync(sb: Db): Promise<void> {
  for (const [tabel, kolom, prefiks] of [
    ['edu_trip_reservations', 'booking_id', 'SPR-%'],
    ['rental_bookings', 'booking_id', 'SPR-%'],
    ['accommodation_bookings', 'booking_id', 'SPI-%'],
    ['bookings', 'booking_code', 'SPR-%'],
    ['bookings', 'booking_code', 'SPI-%'],
  ] as const) {
    const { error } = await sb.from(tabel).delete().like(kolom, prefiks)
    if (error) throw new Error(`hapus ${prefiks} di ${tabel}: ${error.message}`)
  }
}

// Satu batch gagal tidak boleh mengorbankan 99 baris lain: ulangi per baris.
async function sisipBertahap(sb: Db, tabel: string, rows: Record<string, unknown>[]): Promise<number> {
  let gagal = 0
  for (let i = 0; i < rows.length; i += 100) {
    const potong = rows.slice(i, i + 100)
    const { error } = await sb.from(tabel).insert(potong)
    if (!error) continue
    for (const baris of potong) {
      const { error: errSatu } = await sb.from(tabel).insert([baris])
      if (errSatu) gagal++
    }
  }
  return gagal
}

export interface OpsiSinkron {
  supabase: Db
  paksa?: boolean
  sheetSewaId?: string
  sheetPenginapanId?: string
}

export interface RingkasanSinkron {
  ok: boolean
  pesan: string
  sewa?: { perTab: RingkasanTab[]; bookings: number; rentals: number; edu: number; gagalInsert: number }
  penginapan?: { perTab: RingkasanTab[]; bookings: number; gagalInsert: number }
  masalah: string[]
}

export async function jalankanSinkronisasi(opsi: OpsiSinkron): Promise<RingkasanSinkron> {
  const { supabase: sb, paksa = false } = opsi
  const sheetSewa = opsi.sheetSewaId || process.env.JADWAL_SHEET_ID || SHEET_SEWA_DEFAULT
  const sheetPenginapan = opsi.sheetPenginapanId || process.env.PENGINAPAN_SHEET_ID || SHEET_PENGINAPAN_DEFAULT

  if (!(await cobaKunci(sb))) {
    return {
      ok: false,
      pesan: `Sinkronisasi lain baru saja berjalan (jeda minimum ${LOCK_JEDA_DETIK} detik). Coba lagi sebentar.`,
      masalah: [],
    }
  }
  try {
    const [tabsSewa, tabsPenginapan, katalogRes] = await Promise.all([
      ambilSemuaTab(sheetSewa),
      ambilSemuaTab(sheetPenginapan),
      sb.from('inventory_rentals').select('id,name'),
    ])
    if (katalogRes.error) throw new Error(`katalog inventory: ${katalogRes.error.message}`)
    const katalog: Venue[] = (katalogRes.data ?? []).map((c) => ({ item_id: c.id, item_name: c.name, key: normalize(c.name) }))
    if (tabsSewa.length === 0) throw new Error('Sheet sewa tempat tidak dapat dibaca (privat atau ID salah)')

    const sewa = bangunSewa(tabsSewa, katalog)
    const penginapan = bangunPenginapan(tabsPenginapan)

    // Fail-safe: bandingkan dengan jumlah data saat ini SEBELUM menghapus apa pun.
    const sprLama = await hitungPrefiks(sb, 'SPR-')
    const spiLama = await hitungPrefiks(sb, 'SPI-')
    if (!paksa && sprLama > 20 && sewa.bookings.length < sprLama * 0.5) {
      return {
        ok: false,
        pesan: `Dibatalkan fail-safe: hasil parse sewa (${sewa.bookings.length}) jauh lebih sedikit dari data saat ini (${sprLama}). Bila memang benar, gunakan "Paksa sinkron" dari dashboard admin.`,
        masalah: sewa.masalah,
      }
    }
    if (!paksa && spiLama > 20 && penginapan.bookings.length < spiLama * 0.5) {
      return {
        ok: false,
        pesan: `Dibatalkan fail-safe penginapan: hasil parse (${penginapan.bookings.length}) vs data saat ini (${spiLama}).`,
        masalah: penginapan.masalah,
      }
    }

    await hapusDataSync(sb)
    const gagalB = await sisipBertahap(sb, 'bookings', [...sewa.bookings, ...penginapan.bookings])
    const gagalR = await sisipBertahap(sb, 'rental_bookings', sewa.rentals)
    const gagalE = await sisipBertahap(sb, 'edu_trip_reservations', sewa.edu)
    const gagalA = await sisipBertahap(sb, 'accommodation_bookings', penginapan.akomodasi)

    return {
      ok: true,
      pesan: 'Sinkronisasi selesai.',
      sewa: { perTab: sewa.perTab, bookings: sewa.bookings.length, rentals: sewa.rentals.length, edu: sewa.edu.length, gagalInsert: gagalB + gagalR + gagalE },
      penginapan: { perTab: penginapan.perTab, bookings: penginapan.bookings.length, gagalInsert: gagalA },
      masalah: [...sewa.masalah, ...penginapan.masalah],
    }
  } catch (err) {
    return {
      ok: false,
      pesan: `Sync gagal: ${err instanceof Error ? err.message : 'kesalahan tak diketahui'} — data lama tetap utuh.`,
      masalah: [],
    }
  } finally {
    await lepasKunci(sb)
  }
}
