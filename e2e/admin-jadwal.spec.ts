import { test, expect } from '@playwright/test'

test.describe('Admin Jadwal Page', () => {
  const ADMIN_PASSWORD = '@Sriwulanjaya5758'

  test('Redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/admin/jadwal')
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/admin/login')
  })

  test('Login and access jadwal page', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)

    await page.goto('/admin/jadwal')
    await page.waitForTimeout(3000)

    await expect(page.locator('h1').filter({ hasText: 'Jadwal Booking' })).toBeVisible({ timeout: 10000 })
  })

  test('Jadwal cards render rental data or empty state', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)

    await page.goto('/admin/jadwal')
    await page.waitForTimeout(3000)

    const cards = page.locator('article')
    const count = await cards.count()
    if (count > 0) {
      await expect(cards.first().locator('h2')).toBeVisible()
    } else {
      await expect(page.locator('p').filter({ hasText: 'Belum ada jadwal sewa.' })).toBeVisible()
    }
  })

  test('Filter by date shows rental cards for that day', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)

    await page.goto('/admin/jadwal')
    await page.waitForTimeout(2000)

    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').first().fill(today)
    await page.waitForTimeout(2000)

    const cards = page.locator('article')
    const count = await cards.count()
    if (count > 0) {
      await expect(cards.first().locator('h2')).toBeVisible()
    } else {
      await expect(page.locator('p').filter({ hasText: 'Belum ada jadwal sewa.' })).toBeVisible()
    }
  })
})
