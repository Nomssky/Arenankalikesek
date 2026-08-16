import { test, expect } from '@playwright/test'

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true'

// Regresi dua bug admin paket wisata:
// 1. "Slug harus diisi" — form tidak mengirim slug (backend kini auto-generate).
// 2. Keyboard mobile hilang tiap ketik — AdminModal mencuri fokus tiap re-render.
test.describe('Admin Paket Wisata: tambah via form modal', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan')

  test.use({ viewport: { width: 390, height: 844 } })

  test('fokus tetap di input tiap ketikan dan paket tersimpan tanpa error slug', async ({ page }) => {
    test.skip(!mutationsEnabled, 'perlu E2E_ENABLE_MUTATIONS=true')

    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    await page.goto('/admin/tour-packages')
    await page.getByRole('button', { name: /Tambah Paket/ }).click()

    const nama = page.locator('.admin-modal input[type="text"]').first()
    await expect(nama).toBeVisible({ timeout: 10000 })
    const tag = `E2E-Paket-${Date.now()}`
    await nama.click()
    for (const char of tag) {
      await nama.press(char)
      const stillFocused = await nama.evaluate((el: HTMLInputElement) => document.activeElement === el)
      expect(stillFocused, `fokus input hilang setelah ketik "${char}" (regresi keyboard)`).toBe(true)
    }

    const harga = page.locator('.admin-modal input[type="number"]').first()
    await harga.fill('50000')
    await page.getByRole('button', { name: 'Simpan' }).click()

    await expect(page.getByText('Slug harus diisi')).toHaveCount(0)
    const row = page.locator('tr', { hasText: tag })
    await expect(row).toBeVisible({ timeout: 10000 })

    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: 'Hapus' }).click()
    await expect(page.locator('tr', { hasText: tag })).toHaveCount(0)
  })
})