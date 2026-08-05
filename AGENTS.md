# Arena Kalikesek — Aturan Repo

## Git Workflow

Sebelum commit dan push, selalu cek apakah remote punya commit lebih baru:

1. `git fetch`
2. Bandingkan `git log --oneline main..origin/main` (atau `git status` — jika muncul "have diverged" / "ahead & behind")
3. Jika remote lebih baru: `git pull origin main` dulu, resolve konflik bila ada, baru lanjut commit/push.
4. Push hanya setelah branch sinkron dengan `origin/main`.

Jangan pernah push langsung tanpa memeriksa pull terlebih dahulu — memaksa remote force-update berisiko menghilangkan commit orang lain.

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
