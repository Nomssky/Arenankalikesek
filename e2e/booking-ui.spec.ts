import { expect, test } from '@playwright/test'

test.describe('Alur booking UI tanpa membuat transaksi', () => {
  test('wahana ditambahkan ke keranjang dengan jumlah bertumpuk dari toast', async ({ page }) => {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })

    await page.getByRole('button', { name: 'Wahana & Aktivitas' }).click()

    const cards = page.locator('article').filter({ has: page.getByRole('button', { name: 'Tambah ke Keranjang' }) })
    await expect(cards.first()).toBeVisible({ timeout: 20_000 })
    await expect(cards.nth(1)).toBeVisible({ timeout: 20_000 })
    const firstName = (await cards.nth(0).locator('h2').innerText()).trim()
    const secondName = (await cards.nth(1).locator('h2').innerText()).trim()

    await cards.nth(0).getByRole('button', { name: `Tambah ${firstName}` }).click()
    await cards.nth(0).getByRole('button', { name: 'Tambah ke Keranjang' }).click()

    const toast = page.getByRole('status').filter({ hasText: 'Berhasil ditambahkan ke Keranjang Booking.' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lihat Keranjang' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(firstName)
    await expect(dialog).toContainText('2 pilihan dari 1 layanan')
    await dialog.getByRole('button', { name: 'Tutup checkout' }).click()

    await cards.nth(1).getByRole('button', { name: 'Tambah ke Keranjang' }).click()
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lihat Keranjang' }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText(firstName)
    await expect(page.getByRole('dialog')).toContainText(secondName)
    await expect(page.getByRole('dialog')).toContainText('3 pilihan dari 2 layanan')
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

test.describe('Keranjang Edu Trip & aturan gabung layanan', () => {
  async function addFirstEduTrip(page: import('@playwright/test').Page) {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
    await page.getByRole('button', { name: 'Eduwisata & Kegiatan' }).click()
    const eduCard = page.locator('article').filter({ has: page.getByRole('button', { name: /, tersedia/ }) }).first()
    await expect(eduCard).toBeVisible({ timeout: 20_000 })
    await eduCard.getByRole('button', { name: /, tersedia/ }).first().click()
    await eduCard.getByRole('button', { name: 'Tambahkan ke Keranjang Booking' }).click()
    return eduCard
  }

  test('rincian peserta Edu Trip tampil realtime di keranjang (25 peserta x harga)', async ({ page }) => {
    await addFirstEduTrip(page)

    const toast = page.getByRole('status').filter({ hasText: 'Berhasil ditambahkan ke Keranjang Booking.' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lihat Keranjang' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('25 peserta')
    const breakdown = dialog.getByText(/25 peserta × /)
    await expect(breakdown).toBeVisible()
    const match = (await breakdown.innerText()).match(/Rp([\d.,]+)/)
    expect(match).not.toBeNull()
    const unitPrice = Number((match![1] || '').replace(/\./g, ''))
    await expect(dialog).toContainText(`Rp${(unitPrice * 25).toLocaleString('id-ID')}`)
  })

  test('gabungan sewa tempat dengan penginapan diblokir dengan pesan jelas', async ({ page }) => {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
    await page.getByRole('button', { name: 'Sewa Tempat' }).click()

    const tomorrowDate = new Date()
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`
    await page.getByLabel('Tanggal sewa').fill(tomorrow)

    const venueCard = page.locator('article').first()
    await expect(venueCard).toBeVisible({ timeout: 20_000 })
    const freeSlot = venueCard.locator('button[aria-pressed]:not([disabled])').first()
    await expect(freeSlot).toBeVisible({ timeout: 20_000 })
    await freeSlot.click()
    await venueCard.getByRole('button', { name: 'Tambahkan ke Keranjang Booking' }).click()

    const toast = page.getByRole('status').filter({ hasText: 'Berhasil ditambahkan ke Keranjang Booking.' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lanjut Pilih Layanan' }).click()

    await page.getByRole('button', { name: 'Penginapan & Camping' }).click()
    const availableDays = page.locator('button[aria-label*=", tersedia"]:not([disabled])')
    await expect(availableDays.first()).toBeVisible({ timeout: 20_000 })
    if ((await availableDays.count()) < 2) {
      test.skip(true, 'dibutuhkan minimal 2 tanggal penginapan tersedia')
      return
    }
    await availableDays.nth(0).click()
    await availableDays.nth(1).click()

    await page.getByRole('button', { name: 'Tambahkan ke Keranjang Booking' }).click()

    await expect(page.getByText(/hanya bisa digabung/)).toBeVisible()
  })

  test('jumlah peserta turun otomatis ke 1 saat item Edu Trip terakhir dihapus', async ({ page }) => {
    const eduCard = await addFirstEduTrip(page)
    const eduName = (await eduCard.locator('h2').innerText()).trim()

    let toast = page.getByRole('status').filter({ hasText: 'Berhasil ditambahkan ke Keranjang Booking.' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lanjut Pilih Layanan' }).click()

    await page.getByRole('button', { name: 'Wahana & Aktivitas' }).click()
    const wahanaCard = page.locator('article').filter({ has: page.getByRole('button', { name: 'Tambah ke Keranjang' }) }).first()
    await expect(wahanaCard).toBeVisible({ timeout: 20_000 })
    const wahanaName = (await wahanaCard.locator('h2').innerText()).trim()
    await wahanaCard.getByRole('button', { name: `Tambah ${wahanaName}` }).click()
    await wahanaCard.getByRole('button', { name: 'Tambah ke Keranjang' }).click()

    toast = page.getByRole('status').filter({ hasText: 'Berhasil ditambahkan ke Keranjang Booking.' })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Lanjut ke Checkout' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const participantInput = dialog.getByLabel('Jumlah peserta')
    await expect(participantInput).toHaveValue('25')
    await dialog.getByRole('button', { name: 'Kembali ke pilihan' }).click()
    await dialog.getByRole('button', { name: `Hapus ${eduName}` }).click()
    await dialog.getByRole('button', { name: 'Isi keterangan booking' }).click()
    await expect(participantInput).toHaveValue('1')
  })
})
