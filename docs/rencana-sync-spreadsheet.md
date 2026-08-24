# Rencana Integrasi Spreadsheet → Web Jadwal
**Arenan Kalikesek** · 24 Agustus 2026 · Status: disetujui, dalam implementasi

## 1. Latar Belakang & Tujuan

Saat ini jadwal sewa tempat di web bersumber dari Google Sheets pengelola, tetapi harus diimpor manual (export HTML → jalankan script). Rencana ini membuat alur tersebut **otomatis**: pengelola cukup mengedit spreadsheet seperti biasa, dan jadwal di web ikut berubah hampir seketika — tanpa mengubah cara kerja spreadsheet sedikit pun.

Dua jalur pesanan tetap hidup berdampingan:
1. **Spreadsheet** (pengelola) → tersinkron otomatis ke web
2. **Dashboard admin** (pesanan manual/offline) → tidak pernah tersentuh sinkronisasi

## 2. Prinsip Utama

| Prinsip | Artinya |
|---|---|
| **Sheet hanya dibaca** | Web hanya melakukan GET data; tidak ada kode ditempel di Google, tidak ada tulis-balik |
| **Gratis** | Tanpa layanan berbayar: tarik CSV publik tiap ±5 menit via cron-job.org |
| **Mendekati realtime** | Perubahan di sheet tampil di web maksimal ~5 menit (atau instan lewat tombol Sinkronkan) |
| **Gagal aman** | Sync yang buruk tidak akan pernah lebih buruk dari data lama yang baik |

## 3. Arsitektur

```
Google Sheet Sewa Tempat (12 tab bulan) ┐
Google Sheet Penginapan (Aren/Glamping) ┘
   │ tarik CSV publik per tab (gviz) tiap 5 menit
   ▼
POST /api/cron/sync-jadwal  (dilindungi secret header)
   ▼ lib jadwal-sync.ts
   ├─ validasi kewarasan hasil → gagal? BATALKAN, data lama tetap tayang
   ├─ bersihkan baris SPR-* / SPI-* lama → tulis ulang
   ▼
/jadwal · /admin/jadwal · kuota Eduwisata — terbarui otomatis
+ tombol "Sinkronkan sekarang" di dashboard admin (hasil: ringkasan per tab)
```

Sumber data:
- Sewa tempat: `https://docs.google.com/spreadsheets/d/1gzr2YDHUvJf-dy4lzzsH_jM4NcPbmCAmKRGzFG7tG_I` (tab JANUARI..DESEMBER)
- Penginapan: `https://docs.google.com/spreadsheets/d/1s6OGNLru3a6TpP7CtbgO4qR6wwdswl-hCylH1r2W7UQ`
- Endpoint baca per tab (tanpa kredensial): `…/gviz/tq?tqx=out:csv&sheet=<NAMA_TAB>`

## 4. Ketahanan Terhadap Perubahan Sheet

| Perubahan di sheet | Sikap web |
|---|---|
| Kolom pindah urutan / tambah kolom | Parser baca **berdasar nama header** (fuzzy: `NOMOR HP`/`NO HP`, `CHEK IN`/`CHECK IN`); kolom asing diabaikan |
| Tab bulan baru | Daftar tab diprobe dinamis; tab kosong/hilang dilewati diam-diam |
| Typo/format baru | Aturan longgar; tempat tak dikenal otomatis jadi venue baru; baris bermasalah dilewati + dilaporkan |
| Struktur berubah drastis | Sanity check jumlah baris vs sync sebelumnya; mencurigakan → **batal total**, data lama utuh |
| Sheet dibuat privat | Fetch gagal → sync batal bersih, error dilaporkan, data terakhir tayang |

Prinsip inti: **sync yang buruk tidak akan pernah lebih buruk dari data lama yang baik.**

## 5. Aturan Integrasi Sheet Penginapan (v1)

Data nyata: `TANGGAL` = check-in; tamu menginap n malam = n baris berurutan; kolom "CHEK IN"/"CHEK OUT" berisi nomor bed/tenda & petugas.
- **1 baris = 1 malam terisi** pada unit tsb → kalender publik mengunci malam itu
- Pemetaan unit: `AREN 1–4` → homestay · `CAMP` → camping · `GLAMPING 1/2` → glamping; unit tak dikenal **dilewati + dilaporkan**
- CHEK IN/CHEK OUT/PIC disimpan utuh sebagai catatan; status bayar dari KETERANGAN/DP (aturan lunas/tf/dp/qris yang sudah ada)
- Kode `SPI-*`, terpisah dari `SPR-*`; parser tahun longgar (`21/8/6` → 2026); dedupe per (unit, tanggal)
- ⚠️ Hasil sync pertama wajib direview bareng pengelola sebelum dipercaya penuh

## 6. Keamanan & Celah yang Ditutup

1. **Sync bareng dua proses** → lock atomik via `booking_settings` (UPDATE kondisional); proses kedua ditolak sopan
2. **Secret bocor via URL** → wajib header `X-Sync-Secret` (timing-safe compare); endpoint fail-closed bila env belum diisi
3. **Penyerangan beruntun** → throttle minimum 60 detik antar-sync
4. **Fail-safe kebablasan** → opsi "paksa sinkron" hanya dari sesi admin (kasus sah: sheet memang dikosongkan)
5. **Konflik dengan booking online** → baris bentrok ditolak trigger overlap, dilog FAIL di ringkasan, sisanya lanjut (sama dengan impor manual hari ini)
6. SQL injection / XSS / RLS / skema — pola keamanan existing tetap; **tanpa migration database**

## 7. Fase Implementasi

| Fase | Isi |
|---|---|
| **0** | Bersih-bersih DB: perluas pola `bersihkan-e2e.mjs`; hapus seluruh booking cancelled (keputusan pemilik) |
| **1** | Backend: `lib/jadwal-sync.ts`, endpoint `/api/cron/sync-jadwal` + shim, tombol Sinkronkan di `/admin/jadwal`, unit test parser (`node:test`) |
| **2** | Integrasi penginapan `SPI-*` sesuai aturan v1 |
| **3** | Setup oleh pemilik: cron-job.org gratis tiap 5 menit → endpoint dengan secret; env baru: `JADWAL_SYNC_SECRET`, `JADWAL_SHEET_ID`, `PENGINAPAN_SHEET_ID` |
| **4** | Verifikasi: sync pertama identik dengan data eksisting (EXPECTED_ROWS per bulan); lint/build/e2e hijau → push origin → rilis official atas instruksi pemilik |

## 8. Yang Dibutuhkan dari Pihak Wisata

1. Membiarkan kedua sheet tetap dapat dibaca via link (kondisi sekarang). **Catatan**: nama & nomor HP penyewa saat ini terbaca siapa pun yang punya link — bila ingin privat, integrasi pindah ke Google Service Account (mesin sinkron tetap sama, sumber baca diganti)
2. Tidak perlu mengubah apa pun di sheet — format lama diterima
3. Meluangkan waktu review hasil sync penginapan pertama bersama developer
4. Mendaftarkan cron-job.org (gratis) sekali — atau minta developer pasangkan

## 9. Batasan yang Disepakati

- Baris uji otomatis (E2E) meninggalkan riwayat *cancelled* setelah sesi testing; dibersihkan berkala via `apps/backend/scripts/bersihkan-e2e.mjs`
- Slot sheet yang bentrok dengan booking online sementara hilang dari daftar sampai konflik selesai (terpantau di ringkasan sync)
- Realtime ≈ 5 menit; instan via tombol admin

## 10. Runbook Operasional (setelah aktif)

```bash
# Sinkron manual sekali (lokal):
curl -X POST http://127.0.0.1:3000/api/cron/sync-jadwal \
     -H "X-Sync-Secret: $JADWAL_SYNC_SECRET"

# Cek parser tanpa menulis DB:
node --experimental-strip-types apps/backend/scripts/import-jadwal.cjs --check
```

- Script lama `import-jadwal.cjs` dipertahankan sebagai cadangan manual (flow export HTML), tapi tidak lagi wajib.
- Ringkasan tiap sync (jumlah per tab, baris gagal/alasan) dikembalikan oleh endpoint & terlihat di tombol admin.
