import { test, expect, type Page } from '@playwright/test'

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

test.describe('Jadwal Eduwisata & Kegiatan', () => {
  async function openEduTab(page: Page) {
    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
    await page.getByRole('button', { name: 'Eduwisata & Kegiatan' }).click()
    await expect(page.getByRole('button', { name: 'Pilih tanggal terlebih dahulu' }).first()).toBeVisible()
  }

  test('tab publik: kartu paket + kalender kuota + tombol lanjut terkunci tanpa pilihan', async ({ page }) => {
    await openEduTab(page)

    await expect(page.getByText(/\d+ tanggal tersedia/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bulan sebelumnya' }).first()).toBeDisabled()

    const lockedButton = page.getByRole('button', { name: 'Pilih tanggal terlebih dahulu' }).first()
    await expect(lockedButton).toHaveAttribute('aria-disabled', 'true')

    const nextDay = page.getByRole('button', { name: /\d{4}-\d{2}-\d{2}, tersedia/ }).first()
    if (await nextDay.count()) {
      await nextDay.click()
      await expect(page.getByText(/Dipilih \d+ \w+ \d{4}/).first()).toBeVisible()
      const continueButton = page.getByRole('button', { name: 'Tambahkan ke Keranjang Booking' }).first()
      await expect(continueButton).toHaveAttribute('aria-disabled', 'false')
      await continueButton.click()
      await expect(page.getByText('Berhasil ditambahkan ke Keranjang Booking.')).toBeVisible()
    }
  })

  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan')

  test('admin: tab Eduwisata & Kegiatan memuat tanpa error (regresi GET /api/admin/bookings)', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    await page.goto('/admin/jadwal')
    await expect(page.getByRole('heading', { name: 'Jadwal Booking', level: 1 })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Eduwisata dan Kegiatan' }).click()

    await expect(page.getByText('Gagal memuat jadwal')).toHaveCount(0)
    await expect(page.getByText(/Maksimal \d+\s*rombongan per hari/)).toBeVisible()
    if (await page.locator('table').count() > 0) {
      await expect(page.locator('thead th').first()).toBeVisible()
    } else {
      await expect(page.getByText('Belum ada booking eduwisata pada bulan ini.')).toBeVisible()
    }
  })

  test('admin: detail eduwisata tampil dari /api/admin/edu-trips (inkl. booking impor SPR-/CONTOH-)', async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan')

    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    // Sumber detail = edu_trip_reservations join bookings (bukan filter booking_mode),
    // sehingga tanggal "terisi" di kalender kuota selalu punya baris detail.
    const login = await page.request.post('/api/admin/login', { data: { password: ADMIN_PASSWORD } })
    const cookieHeader = (login.headers()['set-cookie'] || '').split(';')[0]
    expect(cookieHeader.length, 'login admin gagal').toBeGreaterThan(0)
    const api = await page.request.get('/api/admin/edu-trips?start_date=2026-07-01&end_date=2026-07-31', {
      headers: { Cookie: cookieHeader },
    })
    expect(api.status()).toBe(200)
    const rows = await api.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      test.skip(true, 'tidak ada reservasi eduwisata Juli 2026 di server ini')
      return
    }

    await page.goto('/admin/jadwal')
    await expect(page.getByRole('heading', { name: 'Jadwal Booking', level: 1 })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Eduwisata dan Kegiatan' }).click()

    const bookingDate = rows[0].booking_date
    await selectAdminMonth(page, bookingDate)
    await page.getByLabel(new RegExp(formatForAria(bookingDate))).first().click()
    await expect(page.getByText(/Tidak ada booking/)).toHaveCount(0)
    await expect(page.getByText(rows[0].customer_name || '', { exact: false }).first()).toBeVisible()
  })
})

async function selectAdminMonth(page: Page, dateKey: string) {
  const [yearPart, monthPart] = dateKey.split('-')
  const targetYear = Number(yearPart)
  const targetMonth = Number(monthPart)
  const filter = page.getByRole('button', { name: /Bulan lalu|Pilih bulan|^Januari|^Februari|^Maret|^April|^Mei|^Juni|^Juli|^Agustus|^September|^Oktober|^November|^Desember/ })
  await filter.click()
  const yearButton = page.getByRole('button', { name: 'Tahun berikutnya' })
  const yearPrev = page.getByRole('button', { name: 'Tahun sebelumnya' })
  const currentYearLabel = page.locator('.absolute.z-20.mt-2 span.text-sm.font-bold.text-gray-900').first()
  await expect(currentYearLabel).toBeVisible()
  const shownYear = Number(await currentYearLabel.textContent())
  if (shownYear < targetYear) {
    for (let i = 0; i < targetYear - shownYear; i += 1) await yearButton.click()
  } else if (shownYear > targetYear) {
    for (let i = 0; i < shownYear - targetYear; i += 1) await yearPrev.click()
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  await page.getByRole('option', { name: monthNames[targetMonth - 1] }).click()
  await page.getByRole('button', { name: monthNames[targetMonth - 1], exact: false }).waitFor({ state: 'hidden' }).catch(() => undefined)
}

function formatForAria(dateKey: string) {
  // tanggal ARIA di kalender → '12 Juli 2026' (id-ID)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${dateKey}T00:00:00Z`))
    .replace(/\+|\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
