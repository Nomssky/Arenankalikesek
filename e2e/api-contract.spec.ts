import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget

const testItem = { id: 'atv-anak', name: 'ATV Anak', quantity: 1, price: 5000 }
const testDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
const testPhone = () => `08${String(Math.floor(100000000 + Math.random() * 899999999))}`
const hpMain = testPhone()
const hpConflict = testPhone()
let bookingId = ''
let bookingCode = ''

test.describe('API Contract Tests', () => {
  test.skip(
    !mutationEnabled,
    'Tes mutasi hanya berjalan pada localhost dengan E2E_ENABLE_MUTATIONS=true',
  )

  test('POST /api/bookings creates booking with snap token', async ({ request }) => {
    const res = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'E2E Test',
        customerPhone: hpMain,
        items: [testItem],
        totalAmount: testItem.price * testItem.quantity,
        bookingDate: testDate,
        timeStart: '10:00',
        timeEnd: '12:00',
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('bookingId')
    expect(body).toHaveProperty('bookingCode')
    expect(body).toHaveProperty('snapToken')
    expect(body).toHaveProperty('paymentUrl')
    expect(typeof body.bookingId).toBe('string')
    expect(body.bookingId).toMatch(/^BKG-/)
    expect(typeof body.bookingCode).toBe('string')
    expect(body.bookingCode).toMatch(/^BKK-/)
    expect(typeof body.snapToken).toBe('string')
    expect(body.snapToken.length).toBeGreaterThan(0)
    expect(body.paymentUrl).toMatch(/app\.(sandbox\.)?midtrans\.com/)

    bookingId = body.bookingId
    bookingCode = body.bookingCode
  })

  test('GET /api/schedule returns rental_bookings format', async ({ request }) => {
    const res = await request.get(`/api/schedule?start_date=${testDate}&end_date=${testDate}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    if (body.length > 0) {
      const item = body[0]
      expect(item).toHaveProperty('item_id')
      expect(item).toHaveProperty('item_name')
      expect(item).toHaveProperty('time_start')
      expect(item).toHaveProperty('time_end')
      expect(item).toHaveProperty('booking_date')
      expect(item).toHaveProperty('status')
    }
  })

  test('GET /api/invoice/[id] gated hingga lunas (409 tanpa admin)', async ({ request }) => {
    if (!bookingId) test.skip()
    const res = await request.get(`/api/invoice/${bookingId}?phone=${hpMain}`)
    expect(res.status()).toBe(409)
    expect((await res.json()).error).toMatch(/setelah pembayaran/i)
  })

  test('PATCH /api/bookings/[id]/cancel cancels booking', async ({ request }) => {
    if (!bookingId) test.skip()
    const res = await request.patch(`/api/bookings/${bookingId}/cancel`, {
      data: { phone: hpMain },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status', 'cancelled')
  })

  test('POST /api/bookings conflict detection — second booking on same slot conflicts', async ({ request }) => {
    const futureDate = new Date(Date.now() + 86400000 * 9).toISOString().split('T')[0]
    const conflictItem = { id: 'atv-anak', name: 'ATV Anak', quantity: 1, price: 5000 }

    const res = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'Conflict Test',
        customerPhone: hpConflict,
        items: [conflictItem],
        totalAmount: 5000,
        bookingDate: futureDate,
        timeStart: '10:00',
        timeEnd: '12:00',
      },
    })
    expect(res.status()).toBe(200)
    const first = await res.json()
    expect(first).toHaveProperty('bookingId')

    const secondBooking = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'Conflict Test 2',
        customerPhone: testPhone(),
        items: [conflictItem],
        totalAmount: 5000,
        bookingDate: futureDate,
        timeStart: '10:00',
        timeEnd: '12:00',
      },
    })
    expect(secondBooking.status()).toBe(409)
    const body = await secondBooking.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toContain('sudah dibooking')

    await request.patch(`/api/bookings/${first.bookingId}/cancel`, {
      data: { phone: hpConflict },
    })
  })

  test('Availability endpoints return expected shape', async ({ request }) => {
    const month = new Date(Date.now() + 86400000).toISOString().slice(0, 7)
    const accomRes = await request.get(`/api/accommodation-availability?item_id=aren-1&month=${month}`)
    expect(accomRes.status()).toBe(200)
    const accom = await accomRes.json()
    expect(accom).toHaveProperty('itemId')
    expect(accom).toHaveProperty('month')
    expect(Array.isArray(accom.blockedDates)).toBe(true)
    expect(Array.isArray(accom.holidayDates)).toBe(true)

    const eduRes = await request.get(`/api/edu-trip-availability?date=${testDate}`)
    expect(eduRes.status()).toBe(200)
    const edu = await eduRes.json()
    expect(edu).toHaveProperty('quota')
    expect(edu).toHaveProperty('byDate')
    expect(edu).toHaveProperty('remaining')

    const badRes = await request.get('/api/accommodation-availability?month=nonsense')
    expect(badRes.status()).toBe(400)
  })
})
