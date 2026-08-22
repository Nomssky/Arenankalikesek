import { test, expect } from '@playwright/test'

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

// Non-mutasi: memverifikasi pusat kelola reportase di panel admin.
// Tidak menyimpan/menghapus artikel apa pun.
test.describe('Kelola reportase di panel admin', () => {
  test('halaman publik /blog bersih tanpa tombol kelola', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Kelola', exact: true })).toHaveCount(0)
  })

  test('tamu tanpa sesi melihat pesan terkendali di /admin/blog', async ({ page }) => {
    await page.goto('/admin/blog', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Sesi admin berakhir|Gagal memuat artikel/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Masuk sebagai Admin' })).toBeVisible()
  })

  test('admin: tabel artikel + modal tambah berisi templat & toolbar', async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, 'Butuh E2E_ADMIN_PASSWORD')
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD!)
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL(/\/admin(?!\/)/, { timeout: 20_000 })

    await page.goto('/admin/blog', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Reportase' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Tambah Reportase' })).toBeVisible()

    await page.getByRole('button', { name: '+ Tambah Reportase' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Templat format tetap reportase sudah terisi otomatis.
    const content = dialog.locator('#blog-editor-content')
    await expect(content).toBeVisible()
    const value = await content.inputValue()
    expect(value).toContain('**Author :**')
    expect(value).toMatch(/^Sriwulan, \d{1,2} \w+ \d{4} –/m)

    // Toolbar format ramah awam lengkap.
    const toolbar = dialog.getByRole('toolbar', { name: 'Alat format tulisan' })
    for (const tool of ['Judul', 'Subjudul', 'Tebal', 'Miring', 'Daftar', 'Kutipan', 'Tautan']) {
      await expect(toolbar.getByRole('button', { name: tool, exact: true })).toBeVisible()
    }
    await expect(toolbar.getByText('Sisipkan gambar ke isi')).toBeVisible()
  })
})
