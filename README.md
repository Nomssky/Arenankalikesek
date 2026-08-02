# Arenan Kalikesek — Monorepo

Website wisata Arenan Kalikesek (booking, toko, admin panel, blog). Satu repository Git, dua area kerja terpisah: **frontend** dan **backend**, plus paket kode bersama.

## Struktur

```text
├── apps/
│   ├── frontend/        # Next.js 16 — halaman, komponen, styling, asset publik
│   │   └── src/app/api/ # hanya re-export 2 baris → apps/backend (wiring, bukan logika)
│   └── backend/         # Next.js 16 (hanya API) — seluruh logika backend
│       ├── src/app/api/     # route handler (di-deploy bersama frontend via re-export)
│       ├── src/lib/         # supabase, midtrans, admin-auth, booking-settings, dll
│       ├── src/middleware.ts
│       └── supabase/        # migrasi SQL + schema
├── packages/
│   ├── shared-types/    # tipe bersama (BookingStatus, BookingRow, dll)
│   └── shared-utils/    # fungsi murni bersama (booking-domain, pricing katalog)
├── e2e/                 # Playwright — mengetes produksi (https://arenankalikesek.vercel.app)
├── turbo.json           # orchestrasi dev/build/lint/typecheck
└── pnpm-workspace.yaml
```

Arsitektur khusus: **deploy tetap satu project Vercel** (seperti sebelumnya), tetapi logika API tinggal di `apps/backend`. Route handler di `apps/frontend/src/app/api/**` hanyalah shim yang me-*re-export* kode dari `@repo/backend`, jadi developer backend cukup menyentuh `apps/backend` dan developer frontend cukup menyentuh `apps/frontend` tanpa konflik.

## Prasyarat

- Node.js 20.9+ (dikembangkan di 26.x)
- pnpm 10+ (`npm i -g pnpm` atau `corepack enable`)

## Install

```bash
pnpm install
```

`pnpm approve-builds` otomatis terkonfigurasi untuk `sharp` dan `unrs-resolver` (lihat `package.json` → `pnpm.onlyBuiltDependencies`).

## Environment variable

Setiap app punya `apps/*/.env.example`. Salin ke `.env.local`:

```bash
cp apps/frontend/.env.example apps/frontend/.env.local
cp apps/backend/.env.example apps/backend/.env.local
```

Isi nilai asli (tanyakan ke pemilik project untuk secret).

| Variabel | App | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | frontend + backend | URL Supabase (aman untuk browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | backend (**secret**) | service role key — tidak boleh bocor ke browser |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | frontend | Snap.js |
| `NEXT_PUBLIC_MIDTRANS_API_URL` | frontend | CDN Snap (sandbox/prod) |
| `MIDTRANS_SERVER_KEY` | backend (**secret**) | server key |
| `MIDTRANS_API_URL` | backend | API Midtrans server |
| `NEXT_PUBLIC_SITE_URL` | frontend + backend | URL situs untuk redirect pembayaran |
| `ADMIN_PASSWORD` | backend (**secret**) | password admin + HMAC session token |

> Catatan: karena frontend dan backend di-deploy dalam satu project, secret backend **juga** harus ada di `apps/frontend/.env.local` (dan di environment Vercel) agar API berfungsi di produksi. `.env.local` tidak pernah di-commit.

## Menjalankan

```bash
# Semua (frontend :3000 + backend :3001) — turbo
pnpm dev

# Terpisah
pnpm dev:frontend   # http://localhost:3000
pnpm dev:backend    # http://localhost:3001 — tes API langsung di sini
```

Frontend menyajikan API sendiri (shim → kode backend ter-bundle), jadi UI tetap berfungsi walau backend standalone tidak dijalankan. Backend standalone dipakai developer backend untuk menguji endpoint dengan curl tanpa UI.

## Build & check

```bash
pnpm build        # build semua app (turbo)
pnpm lint         # ESLint semua app
pnpm typecheck    # tsc semua app + paket
pnpm test:unit    # unit test (shared-utils + backend)
pnpm test:e2e     # Playwright vs produksi
```

## Workflow Git

`git push` mengirim **commit**, bukan folder. Commit yang hanya menyentuh area sendiri tidak akan bentrok dengan pekerjaan rekan.

```bash
# Developer frontend
git checkout -b frontend/update-homepage
git add apps/frontend packages/
git commit -m "feat(frontend): update homepage"
git push origin frontend/update-homepage

# Developer backend
git checkout -b backend/add-booking-api
git add apps/backend packages/
git commit -m "feat(backend): add booking API"
git push origin backend/add-booking-api
```

Aturan:

- Frontend: hanya ubah `apps/frontend/**`, `packages/shared-*/**`, `e2e/**`, `docs/**`.
- Backend: hanya ubah `apps/backend/**`, `packages/shared-*/**`.
- `packages/shared-*` dipakai dua sisi — perubahan di sana perlu persetujuan kedua pihak.
- Shim di `apps/frontend/src/app/api/**` adalah wiring 2 baris; ubah hanya saat endpoint ditambah/dihapus (backend developer boleh mengubahnya, karena itu bagian dari "permukaan API").

Review otomatis: `.github/CODEOWNERS` menandai reviewer wajib per area (isi dengan username GitHub masing-masing).

## Deployment

Tidak berubah dari sebelumnya: **satu project Vercel**, root directory `apps/frontend`, build command `pnpm build:frontend` (turbo build), output `standalone`. Semua env di atas disetel di dashboard Vercel. Webhook Midtrans tetap di `/api/midtrans/webhook` pada domain yang sama.

## API

Seluruh endpoint sudah berjalan dan TIDAK berubah: `/api/bookings`, `/api/bookings/[id]/cancel`, `/api/invoice/[id]` (butuh `?phone=`), `/api/admin/*` (wajib cookie session), `/api/midtrans/webhook`, `/api/schedule`, `/api/availability`, `/api/booking-config`, dll. Daftar lengkap: lihat `apps/backend/src/app/api/`.

## Menambah migrasi Supabase

Tulis SQL baru di `apps/backend/supabase/migrations/` dengan nomor urut berikutnya, lalu jalankan di dashboard Supabase. Jangan mengubah migrasi yang sudah diterapkan.
