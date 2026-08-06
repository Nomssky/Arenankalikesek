# Reportase

Folder ini menjadi **sumber konten reportase** untuk halaman blog. Blog membaca
post dari dua tempat:

- `apps/frontend/reportase/md/` — artikel reportase (folder ini)
- `apps/frontend/src/content/posts/` — artikel lain (Cerita Desa, Wisata, dll.)

## Cara menambah reportase baru

1. Buat file Markdown di `md/` (folder ini).
   - **Nama file = slug URL** blog (mis. `kkn-maggot-desa-sriwulan.md` → URL
     `/blog/kkn-maggot-desa-sriwulan`). Nama yang deskriptif itu penting; file
     tidak di-rename otomatis agar URL lama yang sudah terbit tetap hidup.
   - Frontmatter cukup `title` saja — sisanya diisi otomatis.
   - Untuk foto di dalam isi: `![](nama-foto.jpg)` (nama file biasa, tanpa
     path) → otomatis disalin ke publik.
2. Letakkan foto di `images/` (nama bebas; yang pertama menjadi sampul bila
   `image:` tidak diisi).
3. Jalankan satu perintah (dari root repo):

   ```bash
   pnpm --filter frontend import:reportase
   # atau pantau terus:
   pnpm --filter frontend import:reportase:watch
   # atau cek tanpa menulis:
   pnpm --filter frontend import:reportase --dry
   ```

   Script otomatis: melengkapi frontmatter (`type: Reportase`, `date`,
   `author`, `excerpt`, `published`), menulis ulang referensi foto
   `!(nama-foto.jpg)` menjadi `/images/nama-foto.jpg`, dan menyalin
   `images/` → `apps/frontend/public/images/`.
   Catatan: bila `date`/`author`/`excerpt` tidak diisi, script mengisinya
   (tanggal default = hari ini) — edit langsung di file bila perlu tanggal
   asli kejadian.

4. Post otomatis masuk ke section **"Reportase Terbaru"** halaman `/blog`.

5. Commit & push (setelah pull terlebih dahulu sesuai aturan repo).

## Catatan

- Gambar di `public/images/` disinkronkan otomatis oleh script **dan** oleh
  hook `predev`/`prebuild` sebelum `next dev`/`next build` — gambar baru selalu
  tersaji tanpa langkah tambahan. Hook tersebut **hanya menyinkronkan gambar**,
  tidak mengubah isi file `.md`.
- Jangan menghapus gambar di `public/images/` yang dipakai post (salinan asli
  ada di `images/` folder ini).
- Post non-reportase jangan ditaruh di folder ini; simpan di
  `apps/frontend/src/content/posts/`.
