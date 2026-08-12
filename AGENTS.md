# Arena Kalikesek — Aturan Repo

## Git Workflow

**WAJIB: sebelum memulai task apa pun, `git pull origin main` dulu** (atau minimal
`git fetch && git status`) agar selalu sinkron dengan kerja orang lain. Jangan
mulai mengerjakan dari versi lama; bisa bentrok saat push.

Sebelum commit dan push, selalu cek apakah remote punya commit lebih baru:

1. `git fetch`
2. Bandingkan `git log --oneline main..origin/main` (atau `git status` — jika muncul "have diverged" / "ahead & behind")
3. Jika remote lebih baru: `git pull origin main` dulu, resolve konflik bila ada, baru lanjut commit/push.
4. Push hanya setelah branch sinkron dengan `origin/main`.

Jangan pernah push langsung tanpa memeriksa pull terlebih dahulu — memaksa remote force-update berisiko menghilangkan commit orang lain. Kalau `pull` diblokir oleh perubahan lokal yang belum di-commit: `git stash push` → `git pull` → `git stash pop` (resolve konflik bila ada).

### Judul Commit & Identitas

Judul commit WAJIB mencantumkan nama orang yang melakukan push, dipisahkan tanda hubung di akhir judul:

```
type(scope): deskripsi singkat - <Nama>
```

Contoh:

```
fix(frontend): batasi produk toko sesuai daftar yang diizinkan - Kresna
```

Ini berlaku untuk semua commit, dikerjakan oleh manusia maupun agent.

### Remote & Hak Akses Push

- **`origin` (repo nomssky/Arenankalikesek)** adalah tempat bekerja semua dev — semua commit/push harian dilakukan di sini.
- **`official` (repo arenankalikesek/Arenankalikesek)** adalah repo produksi. HAKIKATNYA: **tidak boleh di-push langsung oleh dev**.
- **Force-push ke `official` hanya boleh dilakukan oleh pemilik akun `arenankalikesek@gmail.com`** (dan hanya atas instruksi eksplisit pemilik gmail tersebut). Dev lain (termasuk agent) dilarang push ke `official` tanpa instruksi ini.
- Alur rilis: semua dev push ke `origin` → saat pekerjaan selesai, pemilik `arenankalikesek@gmail.com` memberi instruksi rilis → hasil akhir di-squash menjadi **satu commit** (author: `arenankalikesek@gmail.com`) lalu di-force-push ke `official`.

### Rilis ke Repo Resmi (hanya oleh pemilik arenankalikesek@gmail.com)

Saat instruksi rilis diberikan, ikuti alur ini:

1. Pastikan `main` lokal sinkron dengan `origin/main` (commit terbaru semua dev sudah masuk).
2. Potong snapshot single-commit dari `origin/main`:
   ```bash
   GIT_AUTHOR_NAME="Kresna" GIT_AUTHOR_EMAIL="arenankalikesek@gmail.com" \
   GIT_COMMITTER_NAME="Kresna" GIT_COMMITTER_EMAIL="arenankalikesek@gmail.com" \
   git commit-tree "$(git rev-parse origin/main)"^{tree} -m "Deploy produksi Arenan Kalikesek (snapshot origin/main)" 
   ```
3. Simpan SHA hasil `commit-tree`, verifikasi riwayat tidak berantakan di repo lokal/pribadi (tidak perlu membuat branch), lalu force-push SHA tersebut ke `official`:
   ```bash
   git push official SHA:main --force-with-lease
   ```
4. Struktur di `official` menjadi: `root-commit (satu snapshot) → main`.
5. Jangan pernah force-push ke `official` dengan riwayat penuh/personal email — hanya snapshot single-commit resmi di atas.


## Arsitektur Frontend-Backend

**PENTING:** Saat mengerjakan frontend, WAJIB mengikuti arsitektur backend yang sudah ada:

1. **Backend adalah source of truth** untuk semua logika bisnis, validasi, dan harga
2. **Frontend hanya presentasi** — jangan duplikasi business logic di frontend
3. **API routes di frontend** (`apps/frontend/src/app/api/**`) hanyalah **shim 2 baris** yang re-export dari `@repo/backend`
4. **Jangan import server-only code** di frontend (supabase-server, email, midtrans server key, dll)
5. **Gunakan shared packages** (`@repo/shared-types`, `@repo/shared-utils`) untuk tipe dan fungsi murni yang dipakai frontend dan backend
6. **Harga dan total** dihitung server, frontend hanya menampilkan
7. **Validasi client** untuk UX, tapi **validasi server** adalah yang final
8. **Semua operasi database** menggunakan service role di backend, bukan anon client di frontend
9. **Semua state yang wajib konsisten lintas instance / bersifat anti-exploit disimpan di database** (service role), bukan di memori per-instance. Contoh: rate-limit login admin (`admin_login_attempts`), anti-duplikat email (`email_sent_*`), hold slot. Jangan menaruh counter/lock/state di Map in-memory karena instance Serverless (Vercel) bisa ditinggal bebas.
10. **Jangan hardcode data/aturan bisnis otoritatif di frontend.** Daftar/aturan (mis. produk yang boleh tampil di toko, kategori terpilih, ambang harga) diambil dari backend (`products`, `booking_settings`, katalog) lewat API atau `@repo/shared-utils`; frontend boleh memfilter/menampilkan dari data yang dikirim server, tapi tidak boleh memutuskan daftar/aturan sendiri. Anti-pattern yang sudah dihilangkan (jangan dikembalikan): `ALLOWED_PRODUCTS` hardcoded di `toko/page.tsx` → kini `GET /api/products?store=true` (kolom `products.store_visible`).
11. **Keselarasan frontend–backend wajib diverifikasi.** Saat frontend menampilkan perilaku yang ditentukan backend (ketersediaan hold+active, kuota, harga, status store), jangan mengubah shape `response` API; ikuti kontrak yang ada dan tinggalkan satu cek yang bisa dijalankan (e2e Playwright / `scripts/uji-integrasi.mjs`).

### Contoh yang Benar:

```typescript
// Frontend: apps/frontend/src/app/booking/page.tsx
const response = await fetch('/api/bookings', {
  method: 'POST',
  body: JSON.stringify({ items, customerData })
})
const result = await response.json()
// Backend menghitung total, frontend hanya tampilkan
```

### Contoh yang Salah:

```typescript
// ❌ SALAH: Frontend menghitung harga sendiri
const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
// ❌ SALAH: Import supabase service role di frontend
import { getSupabaseAdmin } from '@/lib/supabase-server'
```

Baca `apps/backend/AGENTS.md` dan `apps/frontend/AGENTS.md` untuk detail lengkap tentang batasan dan tanggung jawab masing-masing area.

## Testing

Seluruh pengujian (unit, integrasi, e2e Playwright) dan aturan env-nya dijelaskan
di bagian `# E2E` pada `apps/backend/AGENTS.md`. Ringkas: `pnpm --filter backend test:unit`
(unit), `npm run test:e2e` (UI non-mutasi), `E2E_ENABLE_MUTATIONS=true npm run test:e2e`
(mutasi, localhost), `node apps/backend/scripts/uji-integrasi.mjs` (integrasi). Setiap
perubahan perilaku diharapkan meninggalkan satu cek yang bisa dijalankan.
