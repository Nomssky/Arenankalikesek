import { expect, test, type Page } from '@playwright/test'

async function openDirectBooking(page: Page, query: string) {
  await page.goto(`/booking/wisata?${query}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Konfirmasi booking' })).toBeVisible()
}

function bookingTotal(page: Page) {
  return page.getByText('Total booking').locator('..').locator('..')
}

test.describe('Alur booking UI tanpa membuat transaksi', () => {
  test('kategori Semua tetap dikelompokkan dan pencarian mengikuti kategori aktif', async ({ page }) => {
    await page.goto('/booking/wisata', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    for (const category of ['Wisata & Aktivitas', 'Paket & Edukasi', 'Sewa Tempat', 'Penginapan & Camping']) {
      await expect(page.getByRole('heading', { name: category, exact: true, level: 3 })).toBeVisible()
    }

    await page.getByLabel('Kategori booking').selectOption('sewa-tempat')
    await expect(page.getByRole('heading', { name: 'Sewa Tempat', exact: true, level: 2 }).last()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Wisata & Aktivitas', exact: true, level: 3 })).toHaveCount(0)
    await page.getByLabel('Cari layanan booking').fill('Joglo')
    await expect(page.getByRole('heading', { name: 'Joglo', exact: true, level: 3 })).toBeVisible()
    await page.getByLabel('Cari layanan booking').fill('Berkuda')
    await expect(page.getByText('Layanan tidak ditemukan')).toBeVisible()
  })

  test('beberapa wahana dapat dipilih dan dikalikan dalam satu keranjang', async ({ page }) => {
    await page.goto('/booking/wisata', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    const cards = page.locator('article.motion-card').filter({ has: page.getByRole('button', { name: /^Tambah / }) })
    await expect(cards.first()).toBeVisible({ timeout: 20_000 })
    await expect(cards.nth(1)).toBeVisible({ timeout: 20_000 })
    const firstName = (await cards.nth(0).locator('h3').innerText()).trim()
    const secondName = (await cards.nth(1).locator('h3').innerText()).trim()
    await cards.nth(0).getByRole('button', { name: /^Tambah / }).click()
    await cards.nth(1).getByRole('button', { name: /^Tambah / }).click()
    await cards.nth(0).getByRole('button', { name: /^Tambah / }).click()

    await page.getByRole('button', { name: 'Lanjutkan booking' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(firstName)
    await expect(dialog).toContainText(secondName)
    await expect(dialog).toContainText('3 pilihan dari 2 layanan')
  })

  test('tamu tambahan Aren 1 hanya dikenakan sekali per booking', async ({ page }) => {
    await openDirectBooking(page, 'item=aren-1&checkIn=2026-08-10&checkOut=2026-08-12&directBooking=1')
    await page.getByLabel('Jumlah tamu utama').fill('5')
    await expect(bookingTotal(page)).toContainText('Rp400.000')

    await page.getByRole('checkbox', { name: /Tambahkan tamu di atas kapasitas/ }).check()
    await page.getByLabel('Jumlah tamu tambahan').fill('2')
    await expect(bookingTotal(page)).toContainText('Rp420.000')
    await expect(page.getByText(/Rp10\.000\/orang untuk satu booking/)).toBeVisible()

    await page.getByRole('checkbox', { name: /Tambahkan tamu di atas kapasitas/ }).uncheck()
    await expect(bookingTotal(page)).toContainText('Rp400.000')
  })

  test('harga camping mengikuti malam, opsi sewa tenda, dan add-on', async ({ page }) => {
    await openDirectBooking(page, 'item=camping-ground&checkIn=2026-08-10&checkOut=2026-08-12&directBooking=1')
    await expect(bookingTotal(page)).toContainText('Rp40.000')

    await page.getByRole('radio', { name: /Sewa tenda/ }).check()
    await page.getByLabel('Jumlah paket kayu bakar').fill('1')
    await page.getByLabel('Jumlah sewa nesting').fill('1')
    await page.getByLabel('Jumlah kursi camping').fill('1')
    await expect(bookingTotal(page)).toContainText('Rp165.000')
  })

  test('durasi dan add-on sewa tempat memperbarui total', async ({ page }) => {
    await openDirectBooking(page, 'item=gazebo-atas&bookingDate=2026-08-10&timeStart=07%3A00&timeEnd=09%3A00&directBooking=1')
    await expect(bookingTotal(page)).toContainText('Rp60.000')

    await page.getByLabel('Kursi').fill('2')
    await page.getByRole('checkbox', { name: /Sound system/ }).check()
    await page.getByLabel('Tikar').fill('3')
    await expect(bookingTotal(page)).toContainText('Rp396.000')
    await page.getByRole('checkbox', { name: /Sound system/ }).uncheck()
    await expect(bookingTotal(page)).toContainText('Rp96.000')
  })

  test('toko memberi notifikasi, modal keranjang, dan checkout tervalidasi', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/toko', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    const addButton = page.getByRole('button', { name: /^Tambahkan .* ke keranjang$/ }).first()
    if ((await addButton.count()) === 0) {
      await expect(page.getByText('Produk tidak ditemukan')).toBeVisible()
      return
    }
    const productName = (await addButton.getAttribute('aria-label'))?.replace(/^Tambahkan | ke keranjang$/g, '') || ''
    await addButton.click()
    await expect(page.getByRole('status').filter({ hasText: 'Produk ditambahkan' })).toBeVisible()
    await page.getByRole('button', { name: 'Lihat keranjang' }).click()
    const dialog = page.getByRole('dialog', { name: 'Keranjang belanja' })
    await expect(dialog).toContainText(productName)
    await dialog.getByRole('button', { name: `Tambah ${productName}` }).click()
    await expect(dialog.getByText('2', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: /Checkout 2 barang/ }).click()

    await expect(page).toHaveURL(/\/toko\/checkout$/)
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
    await page.getByLabel('Nama lengkap').fill('Pengguna Uji')
    await page.getByLabel('Nomor WhatsApp').fill('bukan-nomor')
    await page.getByLabel('Email').fill('email-salah')
    expect(await page.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(false)
    await page.getByLabel('Nomor WhatsApp').fill('0812 3456 7890')
    await page.getByLabel('Email').fill('uji@example.com')
    expect(await page.locator('form').evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(true)
  })

  test('backend lokal menolak nomor dan jadwal lampau sebelum membuat transaksi', async ({ request }) => {
    const basePayload = {
      type: 'wisata',
      customerName: 'Pengguna Uji',
      customerPhone: '081234567890',
      bookingDate: '2020-01-01',
      timeStart: '07:00',
      timeEnd: '08:00',
      participantCount: 1,
      items: [{
        id: 'area-outbound',
        name: 'Area Outbound',
        category: 'area-kegiatan',
        quantity: 1,
        price: 25000,
      }],
      totalAmount: 25000,
    }

    const invalidPhone = await request.post('/api/bookings', {
      data: { ...basePayload, customerPhone: 'nomor-salah' },
    })
    expect(invalidPhone.status()).toBe(400)
    await expect(invalidPhone.json()).resolves.toMatchObject({ error: 'Format nomor WhatsApp tidak valid' })

    const pastSchedule = await request.post('/api/bookings', { data: basePayload })
    expect(pastSchedule.status()).toBe(400)
    await expect(pastSchedule.json()).resolves.toMatchObject({ error: /masa lalu/ })
  })
})
