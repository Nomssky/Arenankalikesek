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
    const date = new Date(Date.now() + 86400000 * 15).toISOString().slice(0, 10)
    const create = await request.post('/api/admin/bookings', {
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
    expect(create.status(), `create: ${await create.text()}`).toBe(200)
    const created = await create.json()
    expect(created.bookingId).toBeTruthy()

    const detail = await adminGet(request, `/api/bookings/${created.bookingId}`)
    expect(detail.status()).toBe(200)
    const booking = await detail.json()
    expect(booking.status).toBe('confirmed')
    expect(booking.payment_status).toBe('paid')

    const rentalsRes = await adminGet(request, `/api/admin/rentals?start_date=${date}&end_date=${date}`)
    const rentals = await rentalsRes.json()
    const target = (rentals || []).filter((r: Record<string, unknown>) => r.booking_id === created.bookingId)
    expect(target.length, 'rental tidak muncul di daftar admin saat confirmed').toBeGreaterThan(0)
    expect(target[0].status).toBe('active')

    const cancelPatch = await request.patch(`/api/bookings/${created.bookingId}`, {
      headers: { Cookie: adminCookie },
      data: { status: 'cancelled' },
    })
    expect(cancelPatch.status(), `patch: ${await cancelPatch.text()}`).toBe(200)
    const cancelled = await cancelPatch.json()
    expect(cancelled.status).toBe('cancelled')

    const postCancel = await adminGet(request, `/api/bookings/${created.bookingId}`)
    expect(postCancel.status()).toBe(200)
    expect((await postCancel.json()).status).toBe('cancelled')
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
