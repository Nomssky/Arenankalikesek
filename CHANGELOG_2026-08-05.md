# Changelog - 2026-08-05

## Ringkasan Perubahan Pull dan Push

### Pull dari Remote (Commit: 39474557)
**Fitur:** Email Notification System (dari Kresna)

**File yang masuk dari remote:**
- `apps/backend/.env.example` - Tambah RESEND_API_KEY
- `apps/backend/AGENTS.md` - Update dokumentasi email notification
- `apps/backend/src/lib/email.ts` - Library email notification (167 baris)
- `apps/backend/supabase/migrations/022_email_notification_and_index_hygiene.sql` - Migration email settings
- `apps/backend/scripts/apply-migrations-live.sql` - Update script migration
- `apps/backend/src/app/api/bookings/route.ts` - Trigger email saat booking dibuat
- `apps/backend/src/app/api/bookings/[id]/payment/route.ts` - Trigger email saat pembayaran
- `apps/backend/src/app/api/midtrans/webhook/route.ts` - Trigger email dari webhook
- `apps/frontend/src/app/admin/bookings/page.tsx` - UI admin booking dengan email toggle
- `apps/frontend/src/app/admin/jadwal/page.tsx` - Update jadwal admin
- `apps/frontend/src/app/admin/laporan/page.tsx` - Halaman laporan baru (206 baris)
- `apps/frontend/src/app/admin/layout.tsx` - Update layout admin
- `apps/frontend/src/app/admin/page.tsx` - Update dashboard admin

**Total perubahan dari pull:** 13 files, +591 insertions, -9 deletions

---

### Push ke Remote (Commit: 751a9537)
**Fitur:** WebGIS Peta Tampil + Remove Preload Warning Gambar Blog

**File yang di-push:**
1. `apps/backend/src/lib/catalog.ts`
2. `apps/frontend/src/app/blog/[slug]/page.tsx`
3. `apps/frontend/src/app/webgis/page.tsx`

**Total perubahan push:** 3 files, +60 insertions, -19 deletions

---

## Detail Perubahan Push

### 1. WebGIS - Peta Tampil Sempurna
**File:** `apps/frontend/src/app/webgis/page.tsx`

**Perubahan:**
- ✅ Tambah `sandbox` attribute: `allow-same-origin allow-scripts allow-popups allow-forms allow-presentation`
- ✅ Tambah `allow` attribute: `geolocation *; microphone *`
- ✅ Tambah `allowFullScreen` untuk fullscreen support
- ✅ Tambah loading state dengan spinner "Memuat peta..."
- ✅ Tambah error state dengan pesan informatif
- ✅ Tambah timeout detection (5 detik) untuk CORS/X-Frame-Options
- ✅ Tambah `useRef` dan `useEffect` untuk monitor iframe load
- ✅ Ubah Hero `height="full"` → `height="md"` agar header tetap terlihat

**Alasan:**
- Iframe tanpa sandbox attribute menyebabkan browser apply restrictive sandbox default
- CORS dan X-Frame-Options blocking tidak terdeteksi tanpa timeout
- Hero full height menyembunyikan header navigation

**Hasil yang diharapkan:**
- Peta Penduduk dan Peta UMKM akan tampil dengan benar
- Loading state saat peta dimuat
- Error message jika peta gagal load (CORS/X-Frame-Options)

---

### 2. Blog - Remove Preload Warning
**File:** `apps/frontend/src/app/blog/[slug]/page.tsx`

**Perubahan:**
- ✅ Hapus `priority` prop dari `<Image>` component

**Alasan:**
- Gambar artikel blog bukan LCP (Largest Contentful Paint) element
- Gambar berada di bawah header/title/breadcrumb
- Next.js prefetch semua blog slugs, menyebabkan gambar di-preload tapi tidak digunakan
- Warning: "mono-peternakan1.png was preloaded but not used within a few seconds"

**Hasil yang diharapkan:**
- Warning preload hilang untuk `mono-peternakan1.png` dan `mono-peternakan2.png`
- Gambar tetap load dengan lazy loading default Next.js

---

### 3. Backend - Catalog Fallback Matching
**File:** `apps/backend/src/lib/catalog.ts`

**Perubahan:**
- ✅ Improve fallback matching untuk support variant names
- ✅ Tambah prefix matching: `rowName.startsWith(fallbackName + ' ')`

**Alasan:**
- Tour package dengan variant (contoh: "Camping A", "Camping B") tidak match dengan fallback "Camping"
- Perlu support untuk variant names dengan prefix matching

**Hasil yang diharapkan:**
- Better catalog mapping untuk tour packages dengan variants
- "Camping A" sekarang match dengan fallback "Camping"

---

## Update AGENTS.md
**File:** `AGENTS.md`

**Perubahan:**
- ✅ Tambah section "Arsitektur Frontend-Backend"
- ✅ Dokumentasi 8 aturan wajib saat mengerjakan frontend
- ✅ Contoh yang benar vs yang salah
- ✅ Reference ke `apps/backend/AGENTS.md` dan `apps/frontend/AGENTS.md`

**Aturan baru:**
1. Backend adalah source of truth
2. Frontend hanya presentasi
3. API routes di frontend hanya shim 2 baris
4. Jangan import server-only code
5. Gunakan shared packages
6. Harga dihitung server
7. Validasi server adalah final
8. Database operations di backend only

---

## Testing dan Verifikasi

### Tests Passed:
- ✅ TypeScript check: No errors (frontend + backend)
- ✅ ESLint: Passed
- ✅ Production build: Success
- ✅ Routes generated: `/webgis`, `/blog/[slug]`, `/jadwal`, dll

### Git Workflow Followed:
1. ✅ `git fetch` - Cek remote commits
2. ✅ `git log main..origin/main` - Bandingkan local vs remote
3. ✅ `git pull origin main` - Pull latest changes (39474557)
4. ✅ Resolve conflicts: None (auto-merge success)
5. ✅ Run tests: TypeScript + Build passed
6. ✅ `git add` - Stage 3 files
7. ✅ `git commit` - Commit dengan pesan jelas
8. ✅ `git push origin main` - Push ke remote (751a9537)

---

## Statistik Perubahan

### Pull (Remote → Local):
```
13 files changed
+591 insertions
-9 deletions
```

**Fitur baru:**
- Email notification system
- Admin laporan page
- Database index optimization

### Push (Local → Remote):
```
3 files changed
+60 insertions
-19 deletions
```

**Perbaikan:**
- WebGIS peta tampil
- Remove preload warning
- Catalog fallback matching

---

## Total Perubahan Gabungan

**Dari commit 7582dc5d ke 751a9537:**
```
16 files changed
+651 insertions
-28 deletions
```

**Breakdown:**
- Backend: 8 files (email.ts, catalog.ts, migrations, env.example, API routes)
- Frontend: 8 files (admin pages, webgis, blog, layout)

---

## Next Steps

1. **Monitor Production:**
   - Cek apakah peta WebGIS tampil dengan benar
   - Verifikasi warning preload hilang di browser console
   - Test email notification system

2. **Verify Deployment:**
   - Vercel akan auto-deploy commit 751a9537
   - Cek logs untuk errors
   - Test di staging/production URL

3. **Documentation:**
   - File investigation WebGIS masih untracked (opsional untuk di-commit)
   - AGENTS.md sudah updated dengan aturan frontend-backend

---

## File Untracked (Tidak Di-commit)

File dokumentasi investigasi WebGIS:
- `AGENTS.md` (sudah di-edit tapi belum di-commit)
- `INVESTIGATION_COMPLETE.txt`
- `README_WEBGIS_INVESTIGATION.md`
- `WEBGIS_INVESTIGATION.md`
- `WEBGIS_INVESTIGATION_COMPLETE.txt`
- `WEBGIS_INVESTIGATION_FINAL_REPORT.md`
- `WEBGIS_INVESTIGATION_INDEX.md`
- `WEBGIS_INVESTIGATION_MANIFEST.md`
- `WEBGIS_INVESTIGATION_SUMMARY.md`
- `WEBGIS_QUICK_REFERENCE.md`

**Catatan:** File-file ini adalah dokumentasi investigasi, bisa di-commit atau dihapus sesuai kebutuhan.

---

**Tanggal:** 2026-08-05
**Commit Push:** 751a9537
**Status:** ✅ SELESAI
