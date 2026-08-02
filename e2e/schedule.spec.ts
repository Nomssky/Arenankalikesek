import { test, expect } from '@playwright/test'

test.describe('Schedule Page', () => {

  test('Jadwal page loads with date picker and venue toggle', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button').filter({ hasText: 'Sewa Tempat' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Penginapan & Camping' })).toBeVisible()
  })

  test('Rental cards render with availability status', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').fill(today)
    await page.waitForTimeout(2000)

    const cards = page.locator('article')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)

    const firstCard = cards.first()
    await expect(firstCard.locator('h2')).toBeVisible()
    await expect(
      firstCard.locator('p').filter({ hasText: /Semua slot tersedia|Ada slot yang sudah terisi/ }).first()
    ).toBeVisible()
  })

  test('Toggle switches to accommodation calendar view', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    await page.locator('button').filter({ hasText: 'Penginapan & Camping' }).click()
    await page.waitForTimeout(1500)

    await expect(page.locator('select')).toBeVisible()
    await expect(page.locator('button[aria-label="Bulan berikutnya"]')).toBeVisible()
    await expect(page.locator('a').filter({ hasText: 'Lanjut booking' })).toBeVisible()
  })
})
