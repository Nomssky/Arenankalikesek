import { test, expect, type Page } from '@playwright/test'

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

test.describe('Jadwal Eduwisata & Kegiatan', () => {
  async function openEduTab(page: Page) {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
    await page.getByRole('button', { name: 'Eduwisata dan Kegiatan' }).click()
    await expect(page.getByLabel('Pilih paket eduwisata atau kegiatan')).toBeVisible()
  }

  test('tab publik: kalender paket + kuota + tombol lanjut terkunci tanpa pilihan', async ({ page }) => {
    await openEduTab(page)

    const options = await page.getByLabel('Pilih paket eduwisata atau kegiatan').locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(1)

    await expect(page.getByText(/Kuota maksimal \d+ rombongan per hari/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bulan sebelumnya' })).toBeDisabled()

    const continueLink = page.getByRole('link', { name: /Lanjut booking|Pilih tanggal & paket/ })
    await expect(continueLink).toHaveAttribute('aria-disabled', 'true')

    await page.getByLabel('Pilih paket eduwisata atau kegiatan').selectOption({ index: 1 })
    const nextDay = page.getByRole('button', { name: /\d{4}-\d{2}-\d{2}, tersedia/ }).first()
    if (await nextDay.count()) {
      await nextDay.click()
      await expect(page.getByText(/tersisa \d+ dari \d+ kuota/)).toBeVisible()
      await expect(continueLink).toHaveAttribute('aria-disabled', 'false')
      await expect(continueLink).toHaveAttribute('href', /\/booking\/wisata\?item=/)
    }
  })

  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan')

  test('admin: tab Eduwisata & Kegiatan memuat tanpa error (regresi GET /api/admin/bookings)', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    await page.goto('/admin/jadwal')
    await expect(page.getByRole('heading', { name: 'Jadwal Booking', level: 1 })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Eduwisata dan Kegiatan' }).click()

    await expect(page.getByText('Gagal memuat jadwal')).toHaveCount(0)
    await expect(page.getByText(/Maksimal \d+ rombongan per hari/)).toBeVisible()
    if (await page.locator('table').count() > 0) {
      await expect(page.locator('thead th').first()).toBeVisible()
    } else {
      await expect(page.getByText('Belum ada booking eduwisata pada bulan ini.')).toBeVisible()
    }
  })
})
