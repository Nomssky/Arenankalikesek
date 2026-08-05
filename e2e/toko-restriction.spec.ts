import { test, expect } from '@playwright/test'

const ALLOWED = ['Pupuk Kompos', 'Pupuk Cair Organik', 'Gula Aren Murni']

// Mock backend /api/products: items diberi flag store_visible; saat ?store=true
// hanya item store_visible yang dikirim (perilaku sama dengan backend asli).
const mockProducts = [
  { id: 'pupuk-kompos', name: 'Pupuk Kompos', price: 10000, price_label: 'Rp10.000', category: 'pupuk', image: '/images/pupuk-kompos.jpg', description: 'Kompos', unit: 'karung', purchasable: true, store_visible: true },
  { id: 'pupuk-cair', name: 'Pupuk Cair Organik', price: 25000, price_label: 'Rp25.000', category: 'pupuk', image: '', description: 'Cair', unit: 'botol', purchasable: true, store_visible: true },
  { id: 'gula-aren', name: 'Gula Aren Murni', price: 30000, price_label: 'Rp30.000', category: 'oleh-oleh', image: '/images/gula-aren.jpg', description: 'Gula', unit: 'kg', purchasable: true, store_visible: true },
  // Produk yang TIDAK bertanda store_visible → tidak boleh tampil di toko:
  { id: 'paket-nasi', name: 'Paket Nasi Box', price: 15000, price_label: 'Rp15.000', category: 'paket-makanan', image: '', description: 'Makanan', unit: 'porsi', purchasable: true, store_visible: false },
  { id: 'keripik-pisang', name: 'Keripik Pisang', price: 12000, price_label: 'Rp12.000', category: 'oleh-oleh', image: '', description: 'Camilan', unit: 'bungkus', purchasable: true, store_visible: false },
]

async function mockProductsApi(page: import('@playwright/test').Page) {
  await page.route('**/api/products?**', (route) => {
    const url = new URL(route.request().url())
    const storeOnly = url.searchParams.get('store') === 'true'
    const items = storeOnly ? mockProducts.filter((p) => p.store_visible) : mockProducts
    return route.fulfill({ json: items })
  })
}

test.describe('Toko: hanya produk store_visible yang ditampilkan (dari backend)', () => {
  test('menampilkan persis daftar yang dikirim backend saat store=true', async ({ page }) => {
    await mockProductsApi(page)
    await page.goto('/toko', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    const names = (await page.locator('article h3').allTextContents()).map((n) => n.trim())
    expect(names.length).toBe(ALLOWED.length)
    for (const name of names) expect(ALLOWED).toContain(name)
    expect(names).not.toContain('Paket Nasi Box')
    expect(names).not.toContain('Keripik Pisang')
  })

  test('produk store_visible tetap bisa ditambahkan ke keranjang', async ({ page }) => {
    await mockProductsApi(page)
    await page.goto('/toko', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    await page.getByRole('button', { name: /^Tambahkan Pupuk Kompos ke keranjang$/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Produk ditambahkan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keranjang 1', exact: true })).toBeVisible()
  })
})
