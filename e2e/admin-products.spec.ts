import { test, expect } from '@playwright/test'

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true'

// Regresi bug "Slug harus diisi" pada create produk toko — form tidak mengirim
// slug, backend kini auto-generate dari nama (sama seperti paket wisata).
test.describe('Admin Produk Toko: tambah via form modal', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan')

  test('produk baru tersimpan dan muncul di tabel', async ({ page }) => {
    test.skip(!mutationsEnabled, 'perlu E2E_ENABLE_MUTATIONS=true')

    await page.goto('/admin/login')
    await page.getByLabel('Kata sandi').fill(ADMIN_PASSWORD || '')
    await page.getByRole('button', { name: /Masuk/ }).click()
    await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10000 })

    await page.goto('/admin/products')
    await page.getByRole('button', { name: /Tambah Produk/ }).click()

    const tag = `E2E-Produk-${Date.now()}`
    await page.locator('.admin-modal input[type="text"]').first().fill(tag)
    await page.locator('.admin-modal input[type="number"]').first().fill('15000')
    await page.getByRole('button', { name: 'Simpan' }).click()

    await expect(page.getByText('Slug harus diisi')).toHaveCount(0)
    const row = page.locator('tr', { hasText: tag })
    await expect(row).toBeVisible({ timeout: 10000 })

    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: 'Hapus' }).click()
    await expect(page.locator('tr', { hasText: tag })).toHaveCount(0)
  })
})