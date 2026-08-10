import { test, expect } from '@playwright/test'

// Item wahana/fishing ditarik dari tampilan publik lewat backend
// (tour_packages.available=false, migrasi 029) — BUKAN daftar hardcode
// di frontend. Cek: API ?available=true tidak mengirim item tsb, sehingga
// /wisata dan /jadwal (tab Wahana & Aktivitas) otomatis tidak memunculkannya.
const HIDDEN_NAMES = ['Kolam Pancing', 'Sewa Alat Pancing', 'Terapi Ikan', 'Pelet Umpan']
const HIDDEN_IDS = ['kolam-pancing', 'sewa-alat-pancing', 'terapi-ikan', 'pelet-umpan']

test.describe('Item wahana yang ditarik (available=false di backend)', () => {
  test('GET /api/tour-packages?available=true tidak mengirim item tersembunyi', async ({ request }) => {
    const response = await request.get('/api/tour-packages?available=true')
    expect(response.ok()).toBe(true)
    const data = await response.json() as { id: string }[]
    const ids = new Set(data.map((item) => item.id))
    for (const id of HIDDEN_IDS) {
      expect(ids.has(id), `${id} seharusnya tidak dikirim`).toBe(false)
    }
    expect(ids.has('berkuda'), 'item aktif tetap dikirim').toBe(true)
    expect(ids.has('keceh-kali')).toBe(true)
  })

  test('/wisata tidak menampilkan kartu item yang ditarik', async ({ page }) => {
    await page.goto('/wisata', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Berkuda', exact: true })).toBeVisible()
    for (const name of HIDDEN_NAMES) {
      await expect(
        page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) }),
      ).toHaveCount(0)
    }
  })

  test('/jadwal tab Wahana & Aktivitas tidak menampilkan item yang ditarik', async ({ page }) => {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Wahana & Aktivitas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Berkuda', exact: true })).toBeVisible()
    for (const name of HIDDEN_NAMES) {
      await expect(
        page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) }),
      ).toHaveCount(0)
    }
  })
})