import { test, expect } from '@playwright/test'

test.describe('booking/sukses', () => {
  test('menampilkan pesan berhasil + ID booking + tombol invoice', async ({ page }) => {
    await page.goto('/booking/sukses?id=TEST-123', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Booking Berhasil!', level: 1 })).toBeVisible()
    await expect(page.getByText('ID Booking: TEST-123')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Lihat Invoice' })).toHaveAttribute('href', '/invoice/TEST-123')
    await expect(page.getByRole('link', { name: /Hubungi via WA/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Kembali ke Home/ })).toBeVisible()
  })
})
