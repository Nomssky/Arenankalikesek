import { test, expect } from '@playwright/test'

test.describe('Schedule Page', () => {

  async function mockRentalSchedule(
    page: import('@playwright/test').Page,
    bookings: Array<Record<string, unknown>> = [],
  ) {
    await page.route('**/api/inventory-rentals', (route) => route.fulfill({
      json: [{ id: 'area-outbound', name: 'Area Outbound', category: 'area-kegiatan', available: true }],
    }))
    await page.route('**/api/schedule?**', (route) => route.fulfill({ json: bookings }))
    await page.route('**/api/tour-packages?**', (route) => route.fulfill({ json: [] }))
  }

  async function openSchedule(page: import('@playwright/test').Page) {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
  }

  test('Jadwal page loads with date picker and venue toggle', async ({ page }) => {
    await openSchedule(page)

    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button').filter({ hasText: 'Sewa Tempat' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Penginapan & Camping' })).toBeVisible()
  })

  test('Rental cards render with availability status', async ({ page }) => {
    await openSchedule(page)

    const today = new Date().toISOString().split('T')[0]
    await page.locator('input[type="date"]').fill(today)
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    const cards = page.locator('article')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)

    const firstCard = cards.first()
    await expect(firstCard.locator('h2')).toBeVisible()
    await expect(firstCard.getByText(/\d+ slot tersedia/)).toBeVisible()
  })

  test('Toggle switches to accommodation calendar view', async ({ page }) => {
    await openSchedule(page)

    await page.locator('button').filter({ hasText: 'Penginapan & Camping' }).click()

    await expect(page.locator('select')).toBeVisible()
    await expect(page.locator('button[aria-label="Bulan berikutnya"]')).toBeVisible()
    await expect(page.locator('a').filter({ hasText: /Pilih tanggal dahulu|Lanjut booking/ })).toBeVisible()
  })

  test('slot lampau tidak dapat dipilih dan memiliki label status', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-08-04T03:30:00.000Z'))
    await mockRentalSchedule(page)
    await openSchedule(page)

    const pastSlot = page.getByRole('button', { name: /10:00 Sudah lewat/i })
    await expect(pastSlot).toBeDisabled()
    await expect(page.getByRole('button', { name: /11:00 s\.d\. 12:00/i })).toBeEnabled()
  })

  test('rentang tidak dapat melewati slot terisi tetapi batas di sampingnya tetap dapat dipilih', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-08-04T03:30:00.000Z'))
    await mockRentalSchedule(page, [{
      item_id: 'area-outbound',
      item_name: 'Area Outbound',
      time_start: '09:00',
      time_end: '10:00',
      booking_date: '2026-08-05',
      status: 'confirmed',
    }])
    await openSchedule(page)
    await page.locator('input[type="date"]').fill('2026-08-05')
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    const seven = page.getByRole('button', { name: /07:00 s\.d\. 08:00/i })
    const eight = page.getByRole('button', { name: /08:00 s\.d\. 09:00/i })
    const nine = page.getByRole('button', { name: /09:00 Terisi/i })
    const ten = page.getByRole('button', { name: /10:00 s\.d\. 11:00/i })
    await expect(nine).toBeDisabled()
    await eight.click()
    await ten.click()
    await expect(page.getByText(/Rentang tersebut melewati slot yang tidak tersedia/)).toBeVisible()
    await expect(ten).toHaveAttribute('aria-pressed', 'false')

    await seven.click()
    const continueLink = page.getByRole('link', { name: 'Lanjut isi data booking' })
    await expect(continueLink).toHaveAttribute('href', /timeStart=07%3A00&timeEnd=09%3A00/)
  })
})
