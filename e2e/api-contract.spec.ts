import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget

const testItem = { id: 'atv-anak', name: 'ATV Anak', quantity: 1, price: 5000 }
const testDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]
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
        customerPhone: '081234567890',
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

  test('GET /api/invoice/[id] returns valid booking', async ({ request }) => {
    if (!bookingId) test.skip()
    const res = await request.get(`/api/invoice/${bookingId}?phone=081234567890`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('id', bookingId)
    expect(body).toHaveProperty('booking_code', bookingCode)
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('payment_status')
    expect(body).toHaveProperty('total_amount', testItem.price * testItem.quantity)
  })

  test('PATCH /api/bookings/[id]/cancel cancels booking', async ({ request }) => {
    if (!bookingId) test.skip()
    const res = await request.patch(`/api/bookings/${bookingId}/cancel`, {
      data: { phone: '081234567890' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status', 'cancelled')
  })

  test('POST /api/bookings conflict detection — second booking on same slot conflicts', async ({ request }) => {
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
    const conflictItem = { id: 'atv-anak', name: 'ATV Anak', quantity: 1, price: 5000 }

    const res = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'Conflict Test',
        customerPhone: '081234567891',
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
        customerPhone: '081234567892',
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
      data: { phone: '081234567891' },
    })
  })

  test('Availability endpoint returns expected shape', async ({ request }) => {
    const res = await request.post('/api/availability', {
      data: { item_id: 'nonexistent-item', start_at: testDate, end_at: testDate },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('available')
    expect(body).toHaveProperty('item_id')
    expect(body).toHaveProperty('data')
    expect(typeof body.available).toBe('boolean')
  })
})
