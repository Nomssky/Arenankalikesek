import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget

const phone = () => `08${String(Math.floor(100000000 + Math.random() * 899999999))}`
const dateIn = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

test.describe('Payment status & resume (perlu E2E_ENABLE_MUTATIONS=true)', () => {
  test.skip(!mutationsEnabled, 'tes mutasi hanya di localhost dengan E2E_ENABLE_MUTATIONS=true')

  test('state pending + canResume, lalu baris salah => 403, cancel mengubah state', async ({ request }) => {
    const bookingDate = dateIn(14)
    const hp = phone()
    const item = { id: 'atv-anak', name: 'ATV Anak', quantity: 1, price: 5000 }
    const create = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'E2E Pay',
        customerPhone: hp,
        items: [item],
        totalAmount: 5000,
        bookingDate,
        timeStart: '09:00',
        timeEnd: '10:00',
      },
    })
    expect(create.status(), `create: ${await create.text()}`).toBe(200)
    const booking = await create.json()

    const wrongPhone = await request.get(`/api/bookings/${booking.bookingId}/payment?phone=089999`)
    expect(wrongPhone.status()).toBe(403)

    const res = await request.get(`/api/bookings/${booking.bookingId}/payment?phone=${hp}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.bookingId).toBe(booking.bookingId)
    expect(body.state).toBe('pending')
    expect(body.bookingCode).toBeTruthy()
    expect(body.totalAmount).toBe(5000)
    expect(Array.isArray(body.services)).toBe(true)
    expect(body.services[0].name).toBe('ATV Anak')
    // paymentUrl/snapToken hanya ada bila Midtrans terkonfigurasi; isi bergantung env.
    expect(typeof body.canResume).toBe('boolean')

    if (body.paymentUrl) {
      expect(body.paymentUrl).toMatch(/midtrans\.com/)
      expect(typeof body.snapToken).toBe('string')
    }

    const cancel = await request.patch(`/api/bookings/${booking.bookingId}/cancel`, { data: { phone: hp } })
    expect(cancel.status(), `cancel: ${await cancel.text()}`).toBe(200)

    const after = await request.get(`/api/bookings/${booking.bookingId}/payment?phone=${hp}`)
    expect(after.status()).toBe(200)
    expect((await after.json()).state).toBe('cancelled')
  })
})
