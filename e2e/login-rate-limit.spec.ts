import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const target = new URL(baseURL)
const isLocalTarget = target.hostname === 'localhost' || target.hostname === '127.0.0.1'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

// Rate-limit DB-backed (migration 023) diuji hanya di localhost: header
// X-Forwarded-For dikirim client bisa ditimpa platform di Vercel — kalau di-prod
// key yang tercatat bisa jadi IP egress CI yang asli dan risikonya mengunci IP itu.
test.describe('Admin login rate-limit DB-backed (localhost)', () => {
  test.skip(!(isLocalTarget && ADMIN_PASSWORD), 'perlu localhost + E2E_ADMIN_PASSWORD')

  test('5 percobaan gagal lalu terblokir 429, sukses mereset', async ({ request }) => {
    const fakeIp = `10.9.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`
    const headers = { 'X-Forwarded-For': fakeIp, 'Content-Type': 'application/json' }

    for (let i = 0; i < 5; i += 1) {
      const res = await request.post('/api/admin/login', { headers, data: { password: 'salah-password' } })
      expect(res.status(), `percobaan ke-${i + 1}: ${await res.text()}`).toBe(401)
    }

    const blocked = await request.post('/api/admin/login', { headers, data: { password: 'salah-password' } })
    expect(blocked.status()).toBe(429)
    expect((await blocked.json()).error).toMatch(/Coba lagi dalam \d+ detik/)

    // Ip dummy tidak pernah dipakai nyata; baris uji tersisa menumpuk per run
    // (keyed IP acak), tidak berpengaruh ke admin. (ponytail: tanpa akses service
    // role dari spec, cleanup lewat ulang login tidak mungkin saat terblokir.)
  })
})
