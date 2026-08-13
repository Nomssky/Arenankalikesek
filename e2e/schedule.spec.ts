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
    await expect(page.locator('button').filter({ hasText: /Pilih tanggal dahulu|Tambahkan ke Keranjang Booking/ })).toBeVisible()
  })

  test('booking penginapan dari jadwal mengirim detail akomodasi per unit', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-08-04T03:30:00.000Z'))
    await page.route('**/api/inventory-rentals', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/schedule?**', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/tour-packages?**', (route) => route.fulfill({ json: [
      { id: 'aren-1', name: 'Aren 1', category: 'homestay', price: 200000, price_label: 'Rp200.000/malam', bookable: true, available: true, note: null, rate_options: [], facilities: [], unit: 'malam', pricing_type: 'fixed', capacity: null },
    ] }))
    await page.route('**/api/accommodation-availability?**', (route) => route.fulfill({ json: { blockedDates: [] } }))
    await page.route('**/api/edu-trip-availability?**', (route) => route.fulfill({ json: { quota: 2, byDate: {} } }))

    let capturedBody = ''
    await page.route('**/api/bookings', async (route) => {
      capturedBody = route.request().postData() || ''
      await route.fulfill({
        json: {
          bookingId: 'e2e-stay-1', bookingCode: 'BKK-E2E-STAY1', expiresAt: '2026-08-04T04:00:00.000Z',
          totalAmount: 400000, status: 'pending', paymentStatus: 'unpaid', snapToken: null, paymentUrl: null,
        },
      })
    })

    await openSchedule(page)
    await page.getByRole('button', { name: 'Penginapan & Camping', exact: true }).click()
    await page.getByRole('button', { name: '2026-08-10, tersedia' }).click()
    await page.getByRole('button', { name: '2026-08-12, tersedia' }).click()
    await page.getByRole('button', { name: 'Tambahkan ke Keranjang Booking' }).click()
    await expect(page.getByText('Berhasil ditambahkan ke Keranjang Booking.')).toBeVisible()
    await page.getByRole('button', { name: 'Lanjut ke Checkout' }).click()
    await expect(page).toHaveURL(/\/jadwal/)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Atas nama', { exact: true }).fill('Uji E2E')
    await dialog.getByLabel('Nomor WhatsApp').fill('081234567890')
    await dialog.getByLabel('Alamat').fill('Jl. Pengujian No. 1')
    await dialog.getByLabel('Jumlah tamu utama', { exact: true }).fill('2')
    await dialog.getByLabel('Jenis dokumen identitas').selectOption('ktp')
    await dialog.getByLabel('Berkas dokumen identitas JPEG').setInputFiles({ name: 'ktp.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) })
    await dialog.getByRole('button', { name: /Lanjut ke Pembayaran/ }).click()

    await expect.poll(() => capturedBody).toContain('name="accommodations"')
    await expect.poll(() => capturedBody).toContain('"itemId":"aren-1"')
    await expect.poll(() => capturedBody).toContain('"guestCount":2')
  })

  test('wahana dapat dipilih lebih dari satu sebelum lanjut booking', async ({ page }) => {
    await page.route('**/api/inventory-rentals', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/schedule?**', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/tour-packages?**', (route) => route.fulfill({ json: [
      { id: 'wahana-a', name: 'Wahana A', category: 'aktivitas', price: 10000, price_label: 'Rp10.000', bookable: true, available: true, note: null },
      { id: 'wahana-b', name: 'Wahana B', category: 'gratis', price: 0, price_label: 'Gratis', bookable: true, available: true, note: null },
    ] }))
    await page.route('**/api/booking-config', (route) => route.fulfill({ json: { settings: {} } }))
    await openSchedule(page)

    await page.getByRole('button', { name: 'Wahana & Aktivitas', exact: true }).click()
    const cards = page.locator('article').filter({ has: page.getByRole('button', { name: 'Tambah ke Keranjang' }) })
    await expect(cards).toHaveCount(2)
    const firstName = (await cards.nth(0).locator('h2').innerText()).trim()
    const secondName = (await cards.nth(1).locator('h2').innerText()).trim()
    await cards.nth(0).getByRole('button', { name: `Tambah ${firstName}` }).click()
    await cards.nth(0).getByRole('button', { name: 'Tambah ke Keranjang' }).click()
    const toast = page.getByRole('status').filter({ hasText: 'Berhasil ditambahkan ke Keranjang Booking.' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lanjut Pilih Layanan' }).click()
    await cards.nth(1).getByRole('button', { name: `Tambah ${secondName}` }).click()
    await cards.nth(1).getByRole('button', { name: 'Tambah ke Keranjang' }).click()
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lihat Keranjang' }).click()
    await expect(page.getByRole('dialog')).toContainText(firstName)
    await expect(page.getByRole('dialog')).toContainText(secondName)
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
    const continueButton = page.getByRole('button', { name: 'Tambahkan ke Keranjang Booking' })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
    await expect(page.getByText('Berhasil ditambahkan ke Keranjang Booking.')).toBeVisible()
  })
})
