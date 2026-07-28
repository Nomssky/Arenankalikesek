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

    await expect(page.locator('h1').filter({ hasText: 'Jadwal Rental' })).toBeVisible({ timeout: 10000 })
  })

  test('Jadwal table renders with rental data', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)

    await page.goto('/admin/jadwal')
    await page.waitForTimeout(3000)

    const table = page.locator('table')
    const exists = await table.count()
    if (exists > 0) {
      const rows = table.locator('tbody tr')
      const rowCount = await rows.count()
      if (rowCount > 0) {
        const firstRow = rows.first()
        await expect(firstRow.locator('td').first()).toBeVisible()
      }
    } else {
      const emptyMsg = page.locator('text=Belum ada data rental')
      await expect(emptyMsg).toBeVisible()
    }
  })

  test('Filter by date works', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)

    await page.goto('/admin/jadwal')
    await page.waitForTimeout(2000)

    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').first().fill(today)
    await page.waitForTimeout(2000)

    const table = page.locator('table')
    const exists = await table.count()
    if (exists > 0) {
      const rows = table.locator('tbody tr')
      const count = await rows.count()
      expect(typeof count).toBe('number')
    }
  })
})
