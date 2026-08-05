import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY

const phone = () => `08${String(Math.floor(100000000 + Math.random() * 899999999))}`

function signature(orderId: string, statusCode: string, grossAmount: string) {
  return createHash('sha512').update(orderId + statusCode + grossAmount + SERVER_KEY).digest('hex')
}

function webhookPayload(orderId: string, { status, code, gross, key }: { status: string; code: string; gross: string; key?: string }) {
  return {
    order_id: orderId,
    transaction_status: status,
    status_code: code,
    gross_amount: gross,
    signature_key: key ?? signature(orderId, code, gross),
  }
}

test.describe('Midtrans webhook (perlu MIDTRANS_SERVER_KEY + localhost)', () => {
  test.skip(!(mutationsEnabled && SERVER_KEY), 'perlu E2E_ENABLE_MUTATIONS + MIDTRANS_SERVER_KEY di env')

  test('signature salah → 401; amount mismatch → 400; status cancel → booking batal', async ({ request }) => {
    const hp = phone()
    const create = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'E2E Webhook',
        customerPhone: hp,
        items: [{ id: 'atv-anak', name: 'ATV Anak', quantity: 1, price: 5000 }],
        totalAmount: 5000,
        bookingDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        timeStart: '10:00',
        timeEnd: '12:00',
      },
    })
    expect(create.status(), `create: ${await create.text()}`).toBe(200)
    const booking = await create.json()

    const badSig = await request.post('/api/midtrans/webhook', {
      data: webhookPayload(booking.bookingId, { status: 'settlement', code: '201', gross: '5000', key: 'deadbeef' }),
    })
    expect(badSig.status()).toBe(401)

    const mismatch = await request.post('/api/midtrans/webhook', {
      data: webhookPayload(booking.bookingId, { status: 'settlement', code: '201', gross: '1' }),
    })
    expect(mismatch.status()).toBe(400)
    expect((await mismatch.json()).error).toBe('Amount mismatch')

    const cancelOk = await request.post('/api/midtrans/webhook', {
      data: webhookPayload(booking.bookingId, { status: 'cancel', code: '201', gross: '5000' }),
    })
    expect(cancelOk.status(), `cancel webhook: ${await cancelOk.text()}`).toBe(200)

    // Booking sudah bukan pending lagi: cancel offline ditolak => bukti status berubah.
    const offlineCancel = await request.patch(`/api/bookings/${booking.bookingId}/cancel`, {
      data: { phone: hp },
    })
    expect(offlineCancel.status()).toBe(400)
  })
})
