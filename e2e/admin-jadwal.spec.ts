import { test, expect, type Page } from '@playwright/test'

test.describe('Admin Jadwal Page', () => {
  const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan untuk akun pengujian resmi')

  async function login(page: Page) {
    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })
  }

  async function openJadwal(page: Page, withLogin: boolean) {
    if (withLogin) await login(page)
    await page.goto('/admin/jadwal')
    await expect(page.getByRole('heading', { name: 'Jadwal Booking', level: 1 })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15000 })
  }

  async function expectTableOrEmpty(page: Page) {
    if (await page.locator('table').count() > 0) {
      await expect(page.locator('table').first()).toBeVisible()
      // Tabel jadwal sewa memuat header venue.
      await expect(page.locator('thead th').first()).toBeVisible()
    } else {
      await expect(page.getByText('Belum ada jadwal sewa pada bulan ini.')).toBeVisible()
    }
  }

  test('Redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/jadwal')
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 })
  })

  test('Login and access jadwal page', async ({ page }) => {
    await openJadwal(page, true)
    await expect(page.getByLabel('Bulan')).toBeVisible()
    await expect(page.getByLabel('Tahun')).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Penginapan & Camping' })).toBeVisible()
  })

  test('Jadwal merender grid sewa atau pesan kosong', async ({ page }) => {
    await openJadwal(page, true)
    await expectTableOrEmpty(page)
  })

  test('Filter bulan (pilih bulan berbeda) memuat ulang jadwal', async ({ page }) => {
    await openJadwal(page, true)

    const currentMonth = new Date().toISOString().slice(5, 7)
    const target = currentMonth === '01' ? '02' : '01'
    await page.getByLabel('Bulan').selectOption(target)
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 15000 })
    await expect(page.getByLabel('Bulan')).toHaveValue(target)
    await expectTableOrEmpty(page)
  })
})
