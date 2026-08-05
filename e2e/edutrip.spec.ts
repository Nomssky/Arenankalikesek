import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget

const phone = () => `08${String(Math.floor(100000000 + Math.random() * 899999999))}`
const dateIn = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

const EDU_ITEM = { id: 'edu-trip-kesek-1', name: 'Edu Trip Kesek 1', category: 'edukasi', quantity: 1, price: 35000 }

test.describe('Edu Trip: kuota hold+active (perlu E2E_ENABLE_MUTATIONS=true)', () => {
  test.skip(!mutationsEnabled, 'tes mutasi hanya di localhost dengan E2E_ENABLE_MUTATIONS=true')

  test('mengisi kuota lalu booking berikutnya ditolak, dan release setelah cancel', async ({ request }) => {
    // Cari tanggal dengan sisa kuota >= 2 (dan tidak terlalu besar agar loop wajar).
    let date = ''
    let remaining = 0
    for (let offset = 2; offset <= 15; offset += 1) {
      const candidate = dateIn(offset)
      const res = await request.get(`/api/edu-trip-availability?date=${candidate}`)
      const body = await res.json()
      if (body.remaining >= 2 && body.remaining <= 5) { date = candidate; remaining = body.remaining; break }
    }
    test.skip(!date, 'tidak ada tanggal dengan sisa kuota 2-5 untuk diuji')

    const created: Array<{ id: string; phone: string }> = []
    for (let i = 0; i < remaining; i += 1) {
      const hp = phone()
      // Jam berjenjang per booking agar tidak bentrok di venue; kuota harian tetap terisi.
      const start = `${9 + i}:00`
      const end = `${10 + i}:00`
      const res = await request.post('/api/bookings', {
        data: {
          type: 'wisata',
          customerName: `E2E Edu ${i}`,
          customerPhone: hp,
          items: [EDU_ITEM],
          totalAmount: 35000,
          bookingDate: date,
          timeStart: start,
          timeEnd: end,
        },
      })
      expect(res.status(), `create ${i}: ${await res.text()}`).toBe(200)
      created.push({ id: (await res.json()).bookingId, phone: hp })
    }

    const avail = await request.get(`/api/edu-trip-availability?date=${date}`)
    const availJson = await avail.json()
    expect(availJson.used).toBe(availJson.quota)

    // Slot terakhir (16-17) tidak menabrak booking di atas; diblokir oleh kuota.
    const extra = await request.post('/api/bookings', {
      data: {
        type: 'wisata',
        customerName: 'E2E Edu Full',
        customerPhone: phone(),
        items: [EDU_ITEM],
        totalAmount: 35000,
        bookingDate: date,
        timeStart: '16:00',
        timeEnd: '17:00',
      },
    })
    expect(extra.status(), `expected 409: ${await extra.text()}`).toBe(409)
    expect((await extra.json()).error).toMatch(/penuh|full/i)

    for (const c of created) {
      const cancel = await request.patch(`/api/bookings/${c.id}/cancel`, { data: { phone: c.phone } })
      expect(cancel.status(), `cancel: ${await cancel.text()}`).toBe(200)
    }

    const freed = await request.get(`/api/edu-trip-availability?date=${date}`)
    expect((await freed.json()).used).toBe(0)
  })
})
