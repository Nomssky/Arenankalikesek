import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true'

// Admin cookies disimpan antar-test via variabel di worker (fullyParallel=false).
let adminCookie = ''

async function loginAdmin(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
  if (adminCookie) return true
  const res = await request.post('/api/admin/login', {
    data: { password: ADMIN_PASSWORD },
  })
  const setCookie = res.headers()['set-cookie'] || ''
  const match = /admin_token=([^;]+)/.exec(setCookie)
  adminCookie = match ? `admin_token=${match[1]}` : ''
  return res.status() === 200 && Boolean(adminCookie)
}

function adminGet(request: import('@playwright/test').APIRequestContext, path: string) {
  return request.get(path, { headers: adminCookie ? { Cookie: adminCookie } : {} })
}

test.describe('Admin: read + offline booking (perlu E2E_ADMIN_PASSWORD)', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan')

  test('login admin dan seluruh endpoint baca admin merespons 200', async ({ request }) => {
    expect(await loginAdmin(request)).toBe(true)

    const checks: Array<[string, boolean]> = [
      ['/api/admin/products', true],
      ['/api/admin/tour-packages', true],
      ['/api/admin/inventory', true],
      ['/api/admin/rentals', true],
      ['/api/admin/accommodations', true],
      ['/api/admin/booking-settings', true],
      ['/api/admin/booking-date-blocks', true],
      ['/api/admin/booking-holiday-dates', true],
      ['/api/bookings', true],
      ['/api/admin/rentals?start_date=2026-01-01&end_date=2026-12-31', true],
    ]

    for (const [path, isArray] of checks) {
      const res = await adminGet(request, path)
      expect(res.status(), `${path} bukan 2xx`).toBeLessThan(300)
      const body = await res.json()
      if (isArray) {
        expect(Array.isArray(body), `${path} bukan array`).toBe(true)
      }
      if (path.includes('booking-settings')) {
        expect(body.length).toBeGreaterThan(0)
        expect(body[0]).toHaveProperty('key')
      }
    }
  })

  test('tanpa cookie admin → 401 (baca mapelindungi)', async ({ request }) => {
    const res = await request.get('/api/admin/products')
    expect(res.status()).toBe(401)
  })

  test('offline booking admin: buat → status paid/confirmed → cancel → bersih', async ({ request }) => {
    test.skip(!mutationsEnabled, 'perlu E2E_ENABLE_MUTATIONS=true')
    expect(await loginAdmin(request)).toBe(true)

    const tag = `E2E-Admin-${Date.now()}`
    const dateIn = (n: number) => new Date(Date.now() + 86400000 * n).toISOString().slice(0, 10)
    // Jangan hardcode satu tanggal: slot venue bisa terisi hold/active dari data
    // nyata (impor jadwal, tes lain). Coba rentang tanggal; 409 = slot penuh,
    // lanjut ke tanggal berikutnya (percobaan 409 tidak menyisakan data).
    let created: { bookingId: string } | null = null
    let date = ''
    for (let offset = 2; offset <= 15 && !created; offset += 1) {
      date = dateIn(offset)
      const res = await request.post('/api/admin/bookings', {
        headers: { Cookie: adminCookie },
        data: {
          customerName: tag,
          customerPhone: '081299990001',
          customerAddress: 'Jl Uji',
          type: 'sewa',
          bookingDate: date,
          timeStart: '07:00',
          timeEnd: '08:00',
          paymentStatus: 'paid',
          totalAmount: 30000,
          items: [{ id: 'gazebo-atas', name: 'Gazebo Atas', category: 'area-kegiatan', quantity: 1, price: 30000 }],
        },
      })
      if (res.status() === 409) continue
      expect(res.status(), `create: ${await res.text()}`).toBe(200)
      created = await res.json()
    }
    test.skip(!created, 'tidak ada tanggal dengan slot gazebo-atas kosong untuk diuji')
    const bookingId = created!.bookingId
    expect(bookingId).toBeTruthy()

    // GET /api/bookings/[id] sudah dihapus (405) — status booking & bayar
    // terbaca dari nested bookings di response rentals.
    const rentalsRes = await adminGet(request, `/api/admin/rentals?start_date=${date}&end_date=${date}`)
    const rentals = await rentalsRes.json()
    const target = (rentals || []).filter((r: Record<string, unknown>) => r.booking_id === bookingId)
    expect(target.length, 'rental tidak muncul di daftar admin saat confirmed').toBeGreaterThan(0)
    expect(target[0].status).toBe('active')
    const bookingInfo = target[0].bookings as { status: string; payment_status: string }
    expect(bookingInfo.status).toBe('confirmed')
    expect(bookingInfo.payment_status).toBe('paid')

    const cancelPatch = await request.patch(`/api/bookings/${bookingId}`, {
      headers: { Cookie: adminCookie },
      data: { status: 'cancelled' },
    })
    expect(cancelPatch.status(), `patch: ${await cancelPatch.text()}`).toBe(200)
    const cancelled = await cancelPatch.json()
    expect(cancelled.status).toBe('cancelled')

    const postCancelRentals = await adminGet(request, `/api/admin/rentals?start_date=${date}&end_date=${date}`)
    const gone = ((await postCancelRentals.json()) || []).filter(
      (r: Record<string, unknown>) => r.booking_id === bookingId,
    )
    expect(gone.length, 'rental masih muncul setelah cancel').toBe(0)
  })

  test('offline booking edu trip: slug otomatis + peserta 25 diterima, <25 ditolak, cancel', async ({ request }) => {
    test.skip(!mutationsEnabled, 'perlu E2E_ENABLE_MUTATIONS=true')
    expect(await loginAdmin(request)).toBe(true)

    const dateIn = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
    let date = ''
    for (let offset = 2; offset <= 15; offset += 1) {
      const candidate = dateIn(offset)
      const avail = await adminGet(request, `/api/edu-trip-availability?date=${candidate}`)
      if (avail.status() === 200 && (await avail.json()).remaining >= 1) { date = candidate; break }
    }
    test.skip(!date, 'tidak ada tanggal dengan sisa kuota edu trip untuk diuji')

    const tag = `E2E Edu Offline ${Date.now()}`
    const createPackage = await request.post('/api/admin/tour-packages', {
      headers: { Cookie: adminCookie },
      data: { name: tag, category: 'paket-edukasi', price: 100000 },
    })
    expect(createPackage.status(), `create paket: ${await createPackage.text()}`).toBe(200)
    const pkg = await createPackage.json()
    expect(pkg.slug, 'slug tidak digenerate otomatis dari nama').toMatch(/^e2e-edu-offline-/)

    const item = { id: pkg.name, name: pkg.name, quantity: 1, price: 100000 }
    const base = {
      customerName: tag,
      customerPhone: '081299990002',
      type: 'wisata',
      bookingDate: date,
      items: [item],
      totalAmount: 100000,
      paymentStatus: 'paid',
    }

    const tooFew = await request.post('/api/admin/bookings', {
      headers: { Cookie: adminCookie },
      data: { ...base, participantCount: 1 },
    })
    expect(tooFew.status(), `peserta 1 harus ditolak: ${await tooFew.text()}`).toBe(400)
    expect((await tooFew.json()).error).toMatch(/minimal 25 peserta/)

    const create = await request.post('/api/admin/bookings', {
      headers: { Cookie: adminCookie },
      data: { ...base, participantCount: 25 },
    })
    expect(create.status(), `create edu: ${await create.text()}`).toBe(200)
    const created = await create.json()

    const cancel = await request.patch(`/api/bookings/${created.bookingId}`, {
      headers: { Cookie: adminCookie },
      data: { status: 'cancelled' },
    })
    expect(cancel.status(), `cancel: ${await cancel.text()}`).toBe(200)

    const remove = await request.delete(`/api/admin/tour-packages/${pkg.id}`, {
      headers: { Cookie: adminCookie },
    })
    expect(remove.status(), `delete paket: ${await remove.text()}`).toBe(200)
  })

  test('halaman dashboard: filter bulan berupa dropdown (bukan input ketik)', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    await page.goto('/admin')
    // MonthFilter = tombol + listbox bulan (bukan <select>/<input> ketik).
    const bulan = page.locator('.admin-filterbar button').first()
    await expect(bulan).toBeVisible({ timeout: 10000 })
    expect(await bulan.evaluate((el: HTMLElement) => el.tagName)).toBe('BUTTON')

    await bulan.click()
    const listbox = page.getByRole('listbox', { name: 'Pilih bulan' })
    await expect(listbox).toBeVisible()
    expect(await listbox.locator('[role="option"]').count()).toBe(12)

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const currentMonth = new Date().toISOString().slice(5, 7)
    const target = currentMonth === '01' ? '02' : '01'
    await listbox.getByRole('option', { name: monthNames[Number(target) - 1] }).click()
    await expect(page.getByText(/Menampilkan jadwal untuk/)).toBeVisible({ timeout: 10000 })
  })

  test('halaman laporan admin dapat dibuka setelah login', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    await page.goto('/admin/laporan')
    await expect(page.getByRole('heading', { name: 'Laporan Pemasukan', level: 1 })).toBeVisible({ timeout: 10000 })
  })
})
