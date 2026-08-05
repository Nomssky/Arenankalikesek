// Uji lapisan email (lib/email.ts) dengan men-stub fetch — tidak menyentuh
// Resend asli. Lib membaca env saat modul di-load → set env DULU lalu dynamic
// import (static import ter-hoist sehingga env not yet set).
process.env.RESEND_API_KEY = 're_test_dummy_key'
process.env.EMAIL_FROM = 'noreply@arenankalikesek.com'
process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'

import { test } from 'node:test'
import assert from 'node:assert/strict'

const { sendBookingCreatedEmail, sendBookingPaidEmail } = await import('../src/lib/email.ts')

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 'BKG-1',
    booking_code: 'BKK-2608-ABCD',
    customer_name: 'Pengguna <Uji>',
    customer_email: 'pengguna@example.com',
    customer_phone: '081234567890',
    total_amount: 123400,
    ...over,
  }
}

// Memasang stub fetch; handler mengembalikan 1 parameter untuk menyatakan jumlah panggilan.
function withFetch<T>(handler: (url: string, init: RequestInit) => Promise<unknown>, fn: (calls: () => number) => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1
    return handler(String(input), init || {}) as Promise<Response>
  }) as typeof fetch
  return fn(() => calls).finally(() => { globalThis.fetch = original })
}

test('sendBookingCreatedEmail mengirim payload yang benar ke Resend', async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails')
    const body = JSON.parse(String(init.body)) as { from: string; to: string[]; subject: string; html: string }
    assert.equal(body.from, 'noreply@arenankalikesek.com')
    assert.deepEqual(body.to, ['pengguna@example.com'])
    assert.match(body.subject, /BKK-2608-ABCD/)
    assert.match(body.html, /Rp123\.400/)
    assert.ok(body.html.includes('&lt;Uji&gt;'), 'HTML harus me-escape nama pelanggan')
    assert.ok(!body.html.includes('<Uji>'))
    assert.ok(body.html.includes('https://example.com/invoice/BKG-1'))
    return { ok: true }
  }, async (calls) => {
    assert.equal(await sendBookingCreatedEmail(booking()), true)
    assert.equal(calls(), 1)
  })
})

test('sendBookingPaidEmail mengirim subject pelunasan', async () => {
  await withFetch(async (_url, init) => {
    const body = JSON.parse(String(init.body)) as { subject: string; html: string }
    assert.match(body.subject, /BKK-2608-ABCD/)
    assert.match(body.html, /lunas/i)
    return { ok: true }
  }, async (calls) => {
    assert.equal(await sendBookingPaidEmail(booking()), true)
    assert.equal(calls(), 1)
  })
})

test('sendBookingCreatedEmail tidak mengirim + return false saat API Resend error', async () => {
  await withFetch(async () => ({ ok: false, text: async () => 'boom' }), async (calls) => {
    assert.equal(await sendBookingCreatedEmail(booking()), false)
    assert.equal(calls(), 1)
  })
})

test('sendEmail menolak alamat email tidak valid tanpa memanggil fetch', async () => {
  await withFetch(async () => ({ ok: true }), async (calls) => {
    assert.equal(await sendBookingCreatedEmail(booking({ customer_email: 'bukan-email' })), false)
    assert.equal(calls(), 0, 'fetch tidak boleh dipanggil untuk email tidak valid')
  })
})
