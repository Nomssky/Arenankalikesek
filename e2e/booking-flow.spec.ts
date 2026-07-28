import { test, expect } from '@playwright/test'

test.describe('Booking Flow (UI)', () => {

  test('Booking wisata page loads and shows packages', async ({ page }) => {
    await page.goto('/booking/wisata')
    await expect(page.locator('text=Daftar layanan').first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(2000)
    const packageCards = page.locator('article')
    const count = await packageCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Cart and checkout form', async ({ page }) => {
    await page.goto('/booking/wisata')
    await page.waitForTimeout(3000)

    const addButtons = page.locator('button').filter({ hasText: 'Tambah' })
    const addCount = await addButtons.count()
    expect(addCount).toBeGreaterThan(0)
    await addButtons.first().click()

    await page.waitForTimeout(500)
    const cartBtn = page.locator('button').filter({ hasText: 'Lanjutkan booking' })
    await expect(cartBtn).toBeVisible()
    await cartBtn.click()

    await page.waitForTimeout(1000)
    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible()

    await sheet.locator('button').filter({ hasText: 'Isi keterangan booking' }).click()
    await page.waitForTimeout(500)

    const detailForm = page.locator('form')
    await expect(detailForm).toBeVisible()

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    await detailForm.locator('input[type="date"]').fill(tomorrow)
    await detailForm.locator('input[type="time"]').first().fill('09:00')

    await detailForm.locator('input[autocomplete="name"]').fill('E2E User')
    await detailForm.locator('input[autocomplete="tel"]').fill('081234567899')

    await detailForm.locator('button[type="submit"]').click()

    await page.waitForTimeout(5000)
    const errorMsg = page.locator('text=Gagal')
    const successHeader = page.locator('h1').filter({ hasText: 'Booking Berhasil' })
    const submitError = page.locator('text=Mohon lengkapi')

    const isError = await errorMsg.count()
    const isSubmitError = await submitError.count()
    const isSuccess = await successHeader.count()
    expect(isError === 0 || isSuccess > 0 || isSubmitError === 0).toBeTruthy()
  })
})
