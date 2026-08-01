# Cara Menambah Blog atau Artikel

Artikel website disimpan sebagai berkas Markdown. Cara ini tidak memerlukan perubahan data Supabase.

## 1. Siapkan gambar artikel

Simpan gambar di folder `public/images`. Gunakan nama berkas yang singkat, huruf kecil, dan tanpa spasi, misalnya:

```text
public/images/blog-panen-raya.jpg
```

Format yang disarankan adalah JPG, PNG, atau WebP. Usahakan ukuran gambar tidak terlalu besar agar halaman tetap cepat dimuat.

## 2. Buat berkas artikel

Buat berkas baru di folder `src/content/posts`. Nama berkas akan menjadi alamat artikel, jadi gunakan huruf kecil dan tanda hubung.

Contoh:

```text
src/content/posts/panen-raya-kalikesek.md
```

Artikel tersebut otomatis memiliki alamat:

```text
/blog/panen-raya-kalikesek
```

Artikel yang memiliki `published: true` otomatis masuk ke halaman Blog. Tiga artikel dengan tanggal terbaru juga otomatis tampil pada bagian “News Arenan Kalikesek” di beranda.

## 3. Isi data artikel

Salin struktur berikut ke berkas baru:

```markdown
---
title: "Judul Artikel"
date: 2026-08-01
author: "Admin Arenan Kalikesek"
category: "Berita"
excerpt: "Ringkasan singkat artikel yang tampil pada kartu blog."
image: /images/blog-panen-raya.jpg
published: true
---

Paragraf pembuka artikel ditulis di sini.

## Judul Bagian

Isi bagian artikel.

- Contoh daftar pertama
- Contoh daftar kedua

Tulisan dapat dibuat **tebal**, *miring*, atau diberi [tautan](https://contoh.com).
```

Keterangan data:

- `title`: judul artikel.
- `date`: tanggal terbit dengan format `YYYY-MM-DD`.
- `author`: nama penulis.
- `category`: kategori yang tampil pada kartu artikel.
- `excerpt`: ringkasan pendek untuk halaman daftar blog.
- `image`: lokasi gambar di dalam folder `public`.
- `published`: gunakan `true` untuk menayangkan artikel atau `false` untuk menyimpannya sebagai draf.

## 4. Periksa di localhost

Jalankan proyek dari folder utama:

```powershell
npm run dev
```

Buka `http://localhost:3000/blog`. Periksa kartu artikel, halaman detail, ejaan, tanggal, gambar, serta tampilannya pada layar ponsel dan komputer.

## 5. Lakukan pemeriksaan kode

Sebelum mengunggah perubahan, jalankan:

```powershell
npm run typecheck
npm run lint
npm run build
```

## 6. Unggah ke GitHub dan Vercel

```powershell
git add src/content/posts public/images
git commit -m "Tambah artikel panen raya Kalikesek"
git push origin main
```

Jika proyek Vercel sudah terhubung ke branch `main`, Vercel akan membuat deployment baru secara otomatis. Periksa status deployment di dashboard Vercel apabila perubahan belum langsung terlihat.

Catatan: jika berkas lain juga diubah, tambahkan berkas tersebut secara sengaja pada perintah `git add`. Jangan menyimpan kata sandi atau data rahasia di dalam artikel.
