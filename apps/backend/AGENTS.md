# AGENTS.md — Backend (Arenan Kalikesek)

Backend monorepo menggunakan **Next.js 16 App Router** sebagai backend-only (route handlers tanpa halaman). Kode backend ini **dibundle ke dalam frontend** saat build Vercel, namun juga dapat dijalankan secara standalone pada `http://localhost:3001`.

---

# Editing Rules (WAJIB DIIKUTI)

Ikuti aturan berikut sebelum mengubah kode apa pun.

## Prinsip umum

- Selalu lakukan **perubahan sekecil mungkin** untuk menyelesaikan tugas.
- Jangan melakukan refactor kecuali diminta secara eksplisit.
- Jangan mengubah perilaku yang sudah berjalan kecuali memang diminta.
- Jangan memindahkan file, folder, atau struktur proyek tanpa instruksi.
- Jangan mengganti nama file, function, interface, export, endpoint, atau environment variable tanpa instruksi.
- Jangan mengubah response API yang sudah digunakan frontend.
- Jangan mengubah migration lama.
- Jangan menghapus komentar yang menjelaskan invariant penting.
- Jika terdapat utilitas yang sudah ada, gunakan utilitas tersebut. Jangan membuat implementasi baru yang duplikat.

Apabila ragu terhadap sebuah perubahan yang dapat memengaruhi frontend, database, atau API, **berhenti dan minta klarifikasi** daripada menebak.

---

# Struktur Repository

```
apps/
├── backend/
│   └── src/
│       ├── app/api/
│       ├── lib/
│       ├── routes/
│       └── middleware.ts
│
└── frontend/
    └── src/app/api/
        (shim re-export)

packages/
├── shared-utils/
└── shared-types/

supabase/
└── migrations/
```

---

# Arsitektur Penting (JANGAN DIUBAH)

## Route Handler

Semua endpoint hidup di

```
src/app/api/**
```

Ini adalah **single source of truth**.

Sedangkan

```
apps/frontend/src/app/api/**
```

hanya berisi shim seperti:

```ts
export { GET, POST } from "@repo/backend/app/api/..."
```

Jangan menaruh implementasi endpoint pada frontend.

Jika:

- menambah method
- menghapus method
- rename method

maka **WAJIB** sinkronkan shim frontend.

---

## Export Map

Backend menggunakan export map:

```json
"./app/api/*": "./src/app/api/*/route.ts"
```

Jangan menghapus atau mengubah mapping ini.

---

## Import Backend

Semua source backend di dalam

```
src/
```

WAJIB menggunakan import relative.

Benar:

```ts
import { foo } from "../../lib/foo";
```

Salah:

```ts
import { foo } from "@/lib/foo";
```

Exception:

```
src/middleware.ts
```

karena berjalan pada konteks backend sendiri.

---

## Shared Packages

Package berikut digunakan bersama frontend:

```
@repo/shared-utils
@repo/shared-types
```

Perubahan di package tersebut merupakan **breaking change** bagi frontend.

Jangan mengubahnya kecuali memang diperlukan.

Gunakan tipe yang sudah tersedia daripada membuat tipe baru.

Hindari penggunaan `any`.

---

# API Compatibility

Frontend bergantung pada kontrak API backend.

Jangan mengubah tanpa instruksi:

- URL endpoint
- HTTP method
- nama query parameter
- nama field request body
- nama field response JSON
- HTTP status code
- format response

Misalnya jangan mengubah:

```json
{
  "phone": "..."
}
```

menjadi

```json
{
  "phoneNumber": "..."
}
```

---

# Error Messages

Beberapa test menggunakan string error tertentu.

Pertahankan error message yang sudah ada.

Contoh:

```
Harga untuk ... tidak valid
```

```
Amount mismatch
```

```
Forbidden
```

Jangan mengganti wording tanpa alasan.

---

# Refactoring Policy

Jangan melakukan refactor kecuali diminta.

Hindari:

- rename file
- rename function
- rename folder
- memindahkan kode
- mengubah struktur project
- mengganti implementasi yang masih benar

Prioritaskan perubahan lokal pada area yang diminta.

---

# Reuse Existing Logic

Jika suatu logika sudah tersedia pada:

```
lib/
shared-utils/
shared-types/
```

gunakan implementasi tersebut.

Jangan copy-paste.

Jangan membuat utilitas baru dengan fungsi yang sama.

---

# Security Invariants (JANGAN DILONGGARKAN)

## 1. RLS

Anon tidak boleh:

- INSERT bookings
- UPDATE bookings
- INSERT rental_bookings
- UPDATE rental_bookings

Semua operasi database menggunakan

```
getSupabaseAdmin()
```

(service role).

Jangan mengganti menjadi anon client.

---

## 2. Harga Otoritatif

Harga selalu dihitung server.

Gunakan

```
authoritativeItemPrice()
```

di

```
routes/bookings.ts
```

Harga client harus cocok dengan katalog:

- getTourService()
- storeProducts()

Jika tidak cocok:

```
400
Harga untuk ... tidak valid
```

Total booking non-stay harus dihitung ulang server.

---

## 3. Cancel Booking

Endpoint:

```
routes/bookings/[id]/cancel.ts
```

Body wajib:

```json
{
  "phone": "..."
}
```

Nomor harus cocok dengan

```
customer_phone
```

setelah normalisasi digit.

Jika tidak cocok:

```
403
```

Jangan menghapus validasi ini.

---

## 4. Invoice

Endpoint:

```
routes/invoice/[id].ts
```

Wajib menggunakan

```
?phone=
```

Nomor harus cocok setelah normalisasi digit.

Jika tidak:

```
403
```

Ini mencegah IDOR.

Jangan dihapus.

---

## 5. Midtrans Webhook

Endpoint:

```
routes/midtrans/webhook.ts
```

WAJIB:

- verifikasi signature
- gross_amount == total_amount booking

Jika berbeda:

```
400
Amount mismatch
```

---

## 6. Admin Login

Endpoint:

```
routes/admin/login.ts
```

Gunakan backoff (authoritative di DB via `record_admin_login_attempt`, migration 023):

- 5× / 15 detik
- 8× / 5 menit
- 12× / 30 menit
- 16× / 1 jam

Counter tersimpan di tabel `admin_login_attempts` (DB-backed, otoritatif lintas
instance Serverless — JANGAN pindahkan kembali ke Map in-memory). Pre-check
membaca `blocked_until`; perangkat gagal memanggil RPC atomik
`record_admin_login_attempt(ip)` yang meng-increment + menghitung stage, berhasil
menghapus baris.

Session menggunakan:

```
HMAC(ADMIN_PASSWORD)
```

Expire:

```
24 jam
```

---

# Database

Migration berada di

```
supabase/migrations/
```

Aturan:

- Jangan edit migration yang sudah live.
- Migration baru menggunakan nomor berikutnya.
- Contoh:

```
010_add_xxx.sql
```

Setelah migration:

1. Jalankan di dashboard Supabase (atau via `apply_migration` untuk pengembangan).
2. Salin migrasi baru ke `scripts/apply-migrations-live.sql` (header saat ini 010-027).

Catatan: `supabase-schema.sql` tidak ada di repo — skema bersumber dari `supabase/migrations/`.

Salinan siap-tempel untuk dashboard: `scripts/apply-migrations-live.sql`.

## Harga Sewa Tempat (venue)

Sumber harga & ketersediaan venue (`area-kegiatan`/`tempat-pertemuan`) adalah tabel
`inventory_rentals` (dikelola via `/admin/inventory`). Endpoint publik
(`tour-packages`, `inventory-rentals`) dan `authoritativeItemPrice` di bookings
membaca DB langsung; `shared-utils/pricing.ts` hanya fallback saat Supabase tidak
dikonfigurasi / tabel kosong. Edit harga admin langsung tercermin ke publik.
Harga homestay/camping/glamping tetap dari `booking_settings` (kategori tersebut
pricing-nya kompleks: rates/weekend/holiday).

---

## reserve_booking RPC

Parameter berikut harus di-cast:

- booking_date
- time_start
- time_end

menjadi:

```
::date
::time
::timestamptz
```

Jangan menghapus cast tersebut.

---

## Overlap Trigger

EXCLUDE USING gist pada migration 007 digunakan untuk mencegah booking penginapan overlap.

Sejak migration 020, hold ikut mengunci slot: trigger `check_rental_booking_overlap`
menyertakan status `'hold'` (venue) dan exclusion constraint penginapan
`WHERE (status IN ('hold','active'))`; kuota Edu Trip menghitung hold+active.
Slot dilepas saat hold kedaluwarsa (15 menit, `expires_at` di bookings/route.ts)
oleh `expire_stale_booking_holds()`.

Migration contract test bergantung pada ini.

## Ketersediaan Publik = hold + active

Endpoint ketersediaan publik (`accommodation-availability`,
`edu-trip-availability`) WAJIB menghitung `status IN ('hold','active')` — selaras
dengan `reserve_booking`, trigger overlap (020), dan `hasScheduleConflict`.
Jangan edit menjadi `status='active'` saja; itu membuat kalender/kuota publik
tampak bebas padahal slot di-hold dan akhirnya 409 saat booking.

## is_staff

`is_staff()` (SECURITY DEFINER) hanya boleh dieksekusi oleh `authenticated`
(dipakai policy RLS `staff_manage_*`). anon/PUBLIC tidak boleh execute — ditutup
sejak migration 023. Jangan re-grant tanpa alasan.

---

# Environment Variables

Copy dari:

```
.env.example
```

ke

```
apps/backend/.env.local
```

Server-only:

- SUPABASE_SERVICE_ROLE_KEY
- MIDTRANS_SERVER_KEY
- ADMIN_PASSWORD
- MIDTRANS_API_URL
- RESEND_API_KEY (opsional — email notif; wajib verifikasi domain di resend.com)
- EMAIL_FROM (opsional, default noreply@arenankalikesek.com)

Public:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
- NEXT_PUBLIC_SITE_URL

## Email notifikasi (Resend)

- Gratis 3.000 email/bulan. Setup sekali: daftar resend.com → add domain
  `arenankalikesek.com` (DNS TXT/MX di registrar) → isi `RESEND_API_KEY`.
- Toggle aktif/non-aktif dipakai admin via `booking_settings`
  `email_notification.enabled` (1/0); email hanya terkirim bila key terpasang.
- Pemicu: booking online dibuat (`sendBookingCreated`) dan pembayaran lunas
  (`sendBookingPaid` di webhook + fallback GET payment). Best-effort, tidak
  pernah melempar ke pemanggil; anti-duplikat via kolom
  `email_sent_created_at`/`email_sent_paid_at` di bookings.
- Offline booking (admin) tidak mengirim email.

Sandbox Midtrans tetap digunakan pada production.

Jangan mengganti ke production tanpa instruksi.

---

# Build & Validation

Setelah mengubah backend:

```bash
pnpm --filter backend typecheck
pnpm --filter backend lint
pnpm --filter backend test:unit
pnpm --filter backend build
pnpm build:frontend
```

Jika mengubah route:

Pastikan:

- frontend shim masih sinkron
- frontend build berhasil

---

# Development

Backend standalone:

```bash
pnpm dev:backend
```

URL:

```
http://localhost:3001
```

Flow yang perlu dicek:

1. POST booking
2. invoice `?phone=`
3. PATCH cancel

---

# E2E

Semua lapisan pengujian dijalankan dari root repo. Playwright butuh server yang
sudah berjalan (`pnpm dev:frontend` atau `pnpm build:frontend && pnpm --filter frontend start`) —
`webServer` tidak dikonfigurasi, jalankan server terlebih dahulu.

```bash
npm run test:e2e               # subset UI + baca (non-mutasi)
E2E_ENABLE_MUTATIONS=true npm run test:e2e   # + tes yang membuat/menghapus data
# atau arahkan ke server jauh:
PLAYWRIGHT_BASE_URL=https://site.example npm run test:e2e
```

Self-cleaning: semua data uji ber-identitas `E2E-`/`Uji ` dan dibatalkan otomatis.

## Tabel lapisan

| File (`e2e/`) | Cakupan | Env |
|---|---|---|
| `ui-audit.spec.ts` | Health semua route publik (4 viewport), proteksi admin, link internal, 404, invoice cache | — |
| `booking-ui.spec.ts` | Kategori/pencarian, homestay, camping, sewa add-on, toko+checkout, tolak input | — |
| `schedule.spec.ts` | Kalender sewa & penginapan (mock API), slot lampau, rentang | — |
| `admin-jadwal.spec.ts` | Login admin + halaman jadwal | `E2E_ADMIN_PASSWORD` |
| `admin.spec.ts` | Login, endpoint baca admin, offline booking (buat→paid→cancel), laporan | `E2E_ADMIN_PASSWORD` (+ mutasi utk offline) |
| `api-contract.spec.ts` | POST booking+snapToken, invoice, cancel, konflik 409, availability shape | `E2E_ENABLE_MUTATIONS` (localhost) |
| `data-sync.spec.ts` | booking→jadwal→invoice→cancel sinkron | `E2E_ENABLE_MUTATIONS` (localhost) |
| `payments.spec.ts` | `GET /api/bookings/[id]/payment` (state/canResume/403) | mutasi (localhost) |
| `webhook.spec.ts` | signature 401, amount mismatch 400, status cancel | mutasi + `MIDTRANS_SERVER_KEY` |
| `availability-hold.spec.ts` | hold homestay memblokir kalender, dilepas saat cancel | mutasi (localhost) |
| `edutrip.spec.ts` | kuota edu hold+active → 409 saat penuh, release | mutasi (localhost) |
| `toko-restriction.spec.ts` | hanya 3 produk izin muncul di `/toko` | — |
| `login-rate-limit.spec.ts` | 5 gagal → 429 (DB-backed, migration 023) | localhost + `E2E_ADMIN_PASSWORD` |
| `sukses.spec.ts` | render `/booking/sukses` | — |

Catatan:
- `E2E_ENABLE_MUTATIONS` + `MIDTRANS_SERVER_KEY` + login-rate-limit **hanya
  deterministik di localhost**. Di Vercel, header `X-Forwarded-For` bisa ditimpa
  platform → rate-limit bisa mengunci IP egress CI; jangan jalankan spec itu ke prod.
- `api-contract.spec.ts`/`data-sync.spec.ts` di-skip otomatis bila bukan localhost.
- Rate-limit meninggalkan 1 baris `admin_login_attempts` ber-IP acak per run
  (tanpa akses service role dari spec tidak bisa dibersihkan) — tidak berbahaya.

## Uji integrasi menyeluruh

`scripts/uji-integrasi.mjs` memverifikasi keselarasan DB ↔ jadwal dan backend ↔
frontend untuk semua tipe booking (sewa tempat per jam + add-on, wisata, homestay,
camping, glamping, toko, edu-trip kuota, pembatalan cascade). Butuh server lokal
(`npm run start` di frontend, build produksi):

```bash
node --experimental-strip-types apps/backend/scripts/uji-integrasi.mjs
```

Patokan harga memakai `@repo/shared-utils` (kode yang sama dengan FE & backend),
jadi selisih total di invoice = bukti ketidakselarasan. Semua booking uji dicancel
setelah diverifikasi.

## Unit test backend

```bash
pnpm --filter backend test:unit   # tests/*.test.ts (node:test, tanpa framework)
```

- `migration-contract.test.ts` — invariant DB (overlap penginapan, kuota edu,
  hold, bucket dokumen, reserve_booking).
- `email.test.ts` — lapisan email/Resend dengan fetch di-stub (tanpa API key asli).

## Runbook manual (tidak diotomatiskan penuh)

- **Email**: daftar resend.com → verifikasi domain `arenankalikesek.com` (DNS
  TXT/MX) → set `RESEND_API_KEY` + `EMAIL_FROM` (Vercel env & `.env.local`) →
  pastikan toggle "Notifikasi Email" aktif di admin → buat booking (email asli)
  → terima "Booking Diterima" → tandai lunas → terima "Pembayaran Lunas" → cek
  tidak dobel via `email_sent_created_at`/`email_sent_paid_at`.
- **Midtrans**: redirect Snap sandbox + fallback `GET /payment` sungguhan.
- **Dokumen identitas**: signed URL di `/admin/bookings`.
- **`import-jadwal --check`** + tinjau `EXPECTED_ROWS` tiap bulan baru.
- Audit keamanan: pastikan anon tidak dapat INSERT/UPDATE `bookings`/
  `rental_bookings`/`accommodation_bookings`/`edu_trip_reservations` (semua
  penulisan lewat service role / `reserve_booking`).

---

# Import Jadwal Manual (Spreadsheet Pengelola)

> **UPDATE 2026-08:** import kini OTOMATIS. Endpoint `POST /api/cron/sync-jadwal`
> (auth: sesi admin ATAU header `X-Sync-Secret` = env `JADWAL_SYNC_SECRET`) menarik
> kedua sheet langsung dari Google (gviz CSV, read-only) dan clean-replace
> `SPR-*` (sewa tempat) + `SPI-*` (penginapan). Cron eksternal gratis
> (cron-job.org) memanggil tiap 5 menit; tombol "Sinkronkan dari Spreadsheet"
> ada di `/admin/jadwal`. Mesin parser + aturan fail-safe:
> `apps/backend/src/lib/jadwal-sync.ts` (dokumen: `docs/rencana-sync-spreadsheet.md`).
> Flow export HTML di bawah hanya cadangan manual.

Jadwal sewa tempat dicatat manual oleh pengelola di Google Sheets, diimpor ke database
untuk jadi sumber halaman jadwal. Script: `apps/backend/scripts/import-jadwal.cjs`.

Perintah (dari root repo):

```bash
node apps/backend/scripts/import-jadwal.cjs            # import + clean replace
node apps/backend/scripts/import-jadwal.cjs --dry      # parse saja, tidak menulis DB
node apps/backend/scripts/import-jadwal.cjs --check    # parse + assert, exit 0/1 (CI-friendly)
node apps/backend/scripts/import-jadwal.cjs /path/dir  # override lokasi file HTML
```

Sumber: export HTML tiap tab bulan (`File → Simpan Halaman`) di
`/home/kresna/Downloads/JADWAL SEWA TEMPAT 2026/<BULAN>.html` (nama file
`JANUARI.html`..`DESEMBER.html`). Kolom wajib: `TANGGAL, TEMPAT, JAM, PENYEWA,
ALAMAT, KETERANGAN, NOMOR HP, PIC`. Desember/November boleh kosong.

Idempoten: semua `bookings` ber-`booking_code LIKE 'SPR-%'` dan `edu_trip_reservations`
ber-`booking_id LIKE 'SPR-%'` dihapus, lalu diimpor ulang. Aman dijalankan kapan saja.

Perilaku impor yang sudah diputus (jangan dirubah tanpa instruksi):

- Tanggal baris lanjutan (merged cells) diisi dari baris sebelumnya; venue kosong juga diwarisi.
- Typo di sheet: `GASEBO→GAZEBO`, `JGLO→JOGO`, tanggal `21/01/25` & `25/01/25` → 2026 (map `TYPO_YEAR_FIX`).
- `JAM`: `10.00`→mulai; `10-12.00`→mulai–selesai; `-`/`FULL DAY`/`PER ORANG`/`MENGINAP`/kosong→null.
  `...-SELESAI` → status rental `returned` (badge Selesai). HP nyasar di kolom JAM dipindah ke NOMOR HP.
- Double-book slot sama (venue+tanggal+jam) → baris kedua `cancelled` + jam null (ponytail:
  sejak migration 011 trigger exempt `status='cancelled'`; jam null dipakai sebagai
  belt-and-suspenders + penanda verifikasi, jam asli tetap ada di `bookings`).
- `payment_status = paid` jika KETERANGAN menyebut lunas/tf/dp/cash/qris.
- Baris berpenanda EDU (`edutrip|outing|study tour`) juga di-insert ke `edu_trip_reservations`
  agar kuota Edu Trip online tahu hari itu sudah ada grup (booking utama tetap `type 'sewa'`).
- Venue tanpa katalog (Area Dukoh, Teras, dll) dibuat `item_id` slug + `item_name` baru
  — muncul di admin jadwal, tidak divalidasi katalog.

`--check` membandingkan hitungan per bulan dengan `EXPECTED_ROWS` di script.
Saat bulan baru mulai terisi data, **perbarui `EXPECTED_ROWS`** (dan runbook ini).

Verifikasi setelah impor:

- Periksa ringkasan (count bookings/rentals, baris `CANCELLED`, `FAIL`).
- Buka `/admin/jadwal` (pengelola) untuk 1-2 tanggal dengan data,
  dan `/jadwal` publik untuk tanggal dengan slot terisi.

---

# Workflow Saat Menambah Feature

Ikuti urutan berikut:

1. Temukan implementasi yang sudah ada.
2. Cari seluruh pemanggilan function terkait.
3. Lakukan perubahan sekecil mungkin.
4. Update backend route jika diperlukan.
5. Sinkronkan frontend shim.
6. Jalankan typecheck.
7. Jalankan build backend.
8. Jalankan build frontend.
9. Verifikasi endpoint secara manual.

---

# Gotchas

- File yang dijalankan langsung oleh Node harus menggunakan import dengan ekstensi `.ts`.
- Jangan memindahkan `lib/types.ts` lama atau alias `@/lib/types`.
- Gunakan `@repo/shared-types`.
- Jangan mengedit `apps/frontend/src/app/api/**` selain sinkronisasi shim.
- Jangan menyimpan secret di source code.
- Gunakan `process.env`.
- Variabel yang boleh diakses browser harus berawalan `NEXT_PUBLIC_`.
- `output: standalone` TIDAK memuat `.env.local` saat dijalankan via
  `node .next/standalone/server.js` → endpoint yang butuh env jadi 503.
  Gunakan `npm run start` (next start) dari `apps/frontend` untuk pengujian lokal.

---

# Sebelum Mengirim Perubahan

Pastikan semua jawaban berikut adalah **YA**.

- Apakah perubahan ini minimal?
- Apakah tidak ada refactor yang tidak diminta?
- Apakah API tetap kompatibel?
- Apakah semua security invariant masih berlaku?
- Apakah migration lama tidak diubah?
- Apakah frontend shim masih sinkron?
- Apakah build backend berhasil?
- Apakah build frontend berhasil?
- Apakah tidak ada duplikasi logic?
- Apakah shared package tetap kompatibel?