# Ops Resmi — Migrasi arenankalikesek.com ke Vercel + Setup Resend

Checklist langkah demi langkah untuk memindahkan domain `arenankalikesek.com`
dari Hostinger (web WordPress lama, hosting sudah tidak aktif) ke Vercel resmi,
plus menyiapkan notifikasi email Resend.

Status saat penulisan (diverifikasi via DNS publik):

| Record | Nilai sekarang | Arti |
|---|---|---|
| NS | `ns1/ns2.dns-parking.com` | DNS dikelola Hostinger |
| A | `153.92.13.234` | IP Hostinger (web lama → HTTP 403, hosting mati) |
| AAAA | `2a02:4780:6:1131:0:da0:fdd6:2` | IPv6 Hostinger |
| MX | `mx1.hostinger.com (5)`, `mx2.hostinger.com (10)` | email domain aktif |
| TXT | `v=spf1 include:_spf.mail.hostinger.com ~all` | SPF email |
| TXT `_dmarc` | `v=DMARC1; p=none` | DMARC |
| Resend verify/DKIM | tidak ada | Resend belum diverifikasi |

Kesimpulan: domain milikmu dan aktif. Tidak perlu beli domain lagi. Cukup
ganti nameserver ke Vercel (registrar tetap Hostinger).

---

## Langkah 1 — Setup proyek Vercel resmi

- Buat project Vercel baru dari repo `arenankalikesek/Arenankalikesek` (bukan repo
  pribadi `Nomssky/Arenankalikesek`).
- Root directory: `/` ; framework preset: Next.js ; install `pnpm install`,
  build `pnpm build` (sesuai `apps/frontend/vercel.json`).
- Deploy pertama ke `*.vercel.app`, pastikan app berjalan sebelum lanjut.

## Langkah 2 — Environment Variables di Vercel

Isi di **Project → Settings → Environment Variables** (Production/Preview/Development).
Karena backend di-bundle ke frontend, semua secret wajib ada di satu project.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_API_URL=
NEXT_PUBLIC_MIDTRANS_API_URL=
ADMIN_PASSWORD=
RESEND_API_KEY=re_...          # isi setelah Langkah 4
EMAIL_FROM=noreply@arenankalikesek.com
NEXT_PUBLIC_SITE_URL=https://arenankalikesek.com
```

- Deploy ulang, pastikan app tetap jalan.
- Midtrans tetap mode sandbox sampai siap produksi.

## Langkah 3 — Sambung domain & pindah nameserver ke Vercel

1. **Vercel** → Settings → Domains → Add `arenankalikesek.com` → pilih
   **Use Vercel DNS**. Catat NS yang diberikan (`ns1.vercel-dns.com`,
   `ns2.vercel-dns.com`).
2. **Hostinger** → Domains → `arenankalikesek.com` → DNS/Nameservers → ganti ke
   NS Vercel. (Registrar tetap Hostinger; domain tetap milikmu.)
3. Tunggu propagasi 0–24 jam. Cek sampai muncul NS Vercel:
   `https://dns.google/resolve?name=arenankalikesek.com&type=NS`

> Urutan ini sengaja sebelum Resend: record Resend ditaruh di Vercel DNS yang
> baru aktif setelah NS pindah. Jangan tambahkan record Resend di Hostinger.

## Langkah 4 — Setup Resend.com

1. Daftar di **resend.com** → **Domains → Add Domain** → `arenankalikesek.com`.
2. Catat record yang diminta (TXT verifikasi, TXT DKIM `resend._domainkey`,
   SPF `amazonses`).
3. Tambahkan record tersebut **di Vercel DNS** (Settings → Domains → DNS Records).
4. Klik **Verify** di Resend → status **Verified**.
5. **API Keys → Create API Key** (`re_...`) → isi `RESEND_API_KEY` di Vercel env.
6. Test kirim email dari dashboard Resend.

## Langkah 5 — Salin ulang record email ke Vercel DNS

Setelah NS pindah, record lama di Hostinger tidak ikut. Salin ke Vercel DNS:

- **A** `@` → diisi otomatis Vercel (atau `76.76.21.21`).
- **CNAME** `www` → `cname.vercel-dns.com` (redirect www sesuai keinginan).
- **MX**: `mx1.hostinger.com` (priority 5) + `mx2.hostinger.com` (priority 10)
  → email `@arenankalikesek.com` tetap jalan.
- **TXT SPF**: gabung, jangan timpa:
  `v=spf1 include:_spf.mail.hostinger.com include:amazonses.com ~all`
- **TXT `_dmarc`**: `v=DMARC1; p=none` (tetap).
- **TXT Resend verify + DKIM** → dari Langkah 4.

## Langkah 6 — Verifikasi akhir

- `https://arenankalikesek.com` → HTTP 200 + SSL valid (Vercel otomatis).
- `www` → redirect ke canonical (konsisten, pilih www→root atau root→www).
- Resend domain **Verified**; booking uji → email "Booking Diterima" &
  "Pembayaran Lunas" sampai.
- `booking_settings.email_notification.enabled` = 1 (sudah aktif).
- Cek Supabase & Midtrans dari domain baru.

## Langkah 7 — Rapikan Hostinger (opsional)

- **Jangan cancel domain** (registrar) — itu milikmu.
- Web hosting lama yang mati bisa dibereskan; record lamanya tidak relevan lagi
  setelah NS pindah.
