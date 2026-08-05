import { test, expect } from '@playwright/test'

const ALLOWED = ['Pupuk Kompos', 'Pupuk Cair Organik', 'Gula Aren Murni']

const mockProducts = [
  { id: 'pupuk-kompos', name: 'Pupuk Kompos', price: 10000, price_label: 'Rp10.000', category: 'pupuk', image: '/images/pupuk-kompos.jpg', description: 'Kompos', unit: 'karung', purchasable: true },
  { id: 'pupuk-cair', name: 'Pupuk Cair Organik', price: 25000, price_label: 'Rp25.000', category: 'pupuk', image: '', description: 'Cair', unit: 'botol', purchasable: true },
  { id: 'gula-aren', name: 'Gula Aren Murni', price: 30000, price_label: 'Rp30.000', category: 'oleh-oleh', image: '/images/gula-aren.jpg', description: 'Gula', unit: 'kg', purchasable: true },
  // Produk yang TIDAK boleh muncul di toko:
  { id: 'paket-nasi', name: 'Paket Nasi Box', price: 15000, price_label: 'Rp15.000', category: 'paket-makanan', image: '', description: 'Makanan', unit: 'porsi', purchasable: true },
  { id: 'keripik-pisang', name: 'Keripik Pisang', price: 12000, price_label: 'Rp12.000', category: 'oleh-oleh', image: '', description: 'Camilan', unit: 'bungkus', purchasable: true },
]

test.describe('Toko: hanya produk yang diizinkan ditampilkan', () => {
  test('menyaring produk di luar daftar izin', async ({ page }) => {
    await page.route('**/api/products', (route) => route.fulfill({ json: mockProducts }))
    await page.goto('/toko', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    const names = await page.locator('article h3').allTextContents()
    const trimmed = names.map((n) => n.trim())
    expect(trimmed.length).toBe(ALLOWED.length)
    for (const name of trimmed) expect(ALLOWED).toContain(name)
    expect(trimmed).not.toContain('Paket Nasi Box')
    expect(trimmed).not.toContain('Keripik Pisang')
  })

  test('produk diizinkan tetap bisa ditambahkan ke keranjang', async ({ page }) => {
    await page.route('**/api/products', (route) => route.fulfill({ json: mockProducts }))
    await page.goto('/toko', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    await page.getByRole('button', { name: /^Tambahkan Pupuk Kompos ke keranjang$/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Produk ditambahkan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keranjang 1', exact: true })).toBeVisible()
  })
})
