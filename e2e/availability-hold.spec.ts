import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true' && isLocalTarget

const JPEG_1PX = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda0008010100003f00f7dfd9ff00f50000000000000000ffd9', 'hex')
const phone = () => `08${String(Math.floor(100000000 + Math.random() * 899999999))}`
const dateIn = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

test.describe('Availability publik mengikuti hold (migration 020)', () => {
  test.skip(!mutationsEnabled, 'tes mutasi hanya di localhost dengan E2E_ENABLE_MUTATIONS=true')

  test('homestay pending memblokir tanggal di kalender, dilepas setelah cancel', async ({ request }) => {
    const checkIn = dateIn(20)
    const checkOut = dateIn(21)
    const month = checkIn.slice(0, 7)

    const before = await request.get(`/api/accommodation-availability?item_id=aren-1&month=${month}`)
    expect(before.status()).toBe(200)
    const beforeJson = await before.json()
    expect(Array.isArray(beforeJson.blockedDates)).toBe(true)
    test.skip(beforeJson.blockedDates.includes(checkIn), 'tanggal sudah terblokir data lain; skip')

    const hp = phone()
    const create = await request.post('/api/bookings', {
      multipart: {
        type: 'wisata',
        customerName: 'E2E Hold',
        customerPhone: hp,
        customerAddress: 'Jl Uji',
        items: JSON.stringify([{ id: 'aren-1', name: 'Aren 1', category: 'homestay', quantity: 1, price: 75000 }]),
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount: '2',
        documentType: 'ktp',
        identityDocument: { name: 'id.jpg', mimeType: 'image/jpeg', buffer: JPEG_1PX },
      },
    })
    expect(create.status(), `create: ${await create.text()}`).toBe(200)
    const booking = await create.json()

    const during = await request.get(`/api/accommodation-availability?item_id=aren-1&month=${month}`)
    const duringJson = await during.json()
    expect(duringJson.blockedDates).toContain(checkIn)

    const cancel = await request.patch(`/api/bookings/${booking.bookingId}/cancel`, { data: { phone: hp } })
    expect(cancel.status(), `cancel: ${await cancel.text()}`).toBe(200)

    const after = await request.get(`/api/accommodation-availability?item_id=aren-1&month=${month}`)
    const afterJson = await after.json()
    expect(afterJson.blockedDates).not.toContain(checkIn)
  })
})
