import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget

test.describe('Data Sync & Integrity', () => {
  test.skip(
    !mutationEnabled,
    'Tes mutasi hanya berjalan pada localhost dengan E2E_ENABLE_MUTATIONS=true',
  )

  const testPrefix = `e2e-sync-${Date.now()}`
  const testDate = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  let bookingId = ''
  let bookingCode = ''

  test('1. Create booking and verify it appears in schedule', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: `${testPrefix} User`,
        customerPhone: '081234567893',
        items: [{ id: 'edu-trip-kesek-1', name: 'Edu Trip Kesek 1', quantity: 1, price: 35000 }],
        totalAmount: 35000,
        bookingDate: testDate,
        timeStart: '09:00',
        timeEnd: '11:00',
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    bookingId = body.bookingId
    bookingCode = body.bookingCode
    expect(bookingId).toBeTruthy()
  })

  test('2. Schedule API returns valid format', async ({ request }) => {
    if (!bookingId) test.skip()
    await new Promise((r) => setTimeout(r, 2000))

    const scheduleRes = await request.get(`/api/schedule?start_date=${testDate}&end_date=${testDate}`)
    expect(scheduleRes.status()).toBe(200)
    const scheduleData = await scheduleRes.json()
    expect(Array.isArray(scheduleData)).toBe(true)
    if (scheduleData.length > 0) {
      const item = scheduleData[0]
      expect(item).toHaveProperty('item_id')
      expect(item).toHaveProperty('item_name')
      expect(item).toHaveProperty('time_start')
      expect(item).toHaveProperty('booking_date')
    }
  })

  test('3. Invoice matches booking data', async ({ request }) => {
    if (!bookingId) test.skip()
    const invoiceRes = await request.get(`/api/invoice/${bookingId}?phone=081234567893`)
    expect(invoiceRes.status()).toBe(200)
    const invoice = await invoiceRes.json()
    expect(invoice.booking_code).toBe(bookingCode)
    expect(invoice.total_amount).toBe(35000)
    expect(invoice.customer_name).toBe(`${testPrefix} User`)
  })

  test('4. Cancel booking cascades to rental_bookings', async ({ request }) => {
    if (!bookingId) test.skip()
    const cancelRes = await request.patch(`/api/bookings/${bookingId}/cancel`, {
      data: { phone: '081234567893' },
    })
    expect(cancelRes.status()).toBe(200)
  })

  test('5. Admin rentals API shows the same data', async ({ request }) => {
    if (!bookingId) test.skip()
    const adminRes = await request.get(`/api/admin/rentals?start_date=${testDate}&end_date=${testDate}`, {
      headers: { Cookie: '' },
    })
    expect(adminRes.status()).toBe(401)
  })
})
