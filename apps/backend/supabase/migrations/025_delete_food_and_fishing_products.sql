-- ============================================================
-- Migration: Hapus produk toko yang bukan tempatnya (paket makanan & fishing)
-- Toko khusus produk pesan-antar Kalikesek (kolang-kaling, gula aren, pupuk, dll).
-- Kategori paket-makanan & fishing bukan bagian toko → dihapus permanen (bukan disembunyikan).
-- ============================================================

DELETE FROM products WHERE category IN ('paket-makanan', 'fishing');