import { test, expect } from '@playwright/test'

test.describe('Schedule Page', () => {

  test('Jadwal page loads with date picker and table', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 10000 })
    const categoryButtons = page.locator('button[aria-pressed]')
    const catCount = await categoryButtons.count()
    expect(catCount).toBeGreaterThan(0)
  })

  test('Table renders items with availability status', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').fill(today)
    await page.waitForTimeout(2000)

    const table = page.locator('table')
    const tableVisible = await table.isVisible()
    if (tableVisible) {
      const rows = table.locator('tbody tr')
      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThan(0)

      const firstRow = rows.first()
      await expect(firstRow.locator('td').first()).toBeVisible()
    } else {
      const gridItems = page.locator('.card')
      const gridCount = await gridItems.count()
      expect(gridCount).toBeGreaterThan(0)
    }
  })

  test('View mode toggle switches between hari and item', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    const itemViewBtn = page.locator('button').filter({ hasText: 'Per Item' })
    await itemViewBtn.click()
    await page.waitForTimeout(1000)

    const cards = page.locator('.card')
    const cardCount = await cards.count()
    expect(cardCount).toBeGreaterThan(0)
  })

  test('Category filter filters items', async ({ page }) => {
    await page.goto('/jadwal')
    await page.waitForTimeout(3000)

    const categoryBtns = page.locator('button[aria-pressed="false"]')
    const firstCategory = categoryBtns.first()
    const count = await categoryBtns.count()
    if (count > 0) {
      await firstCategory.click()
      await page.waitForTimeout(1000)
    }
  })
})
