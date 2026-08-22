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

    // Kerangka (judul tebal + Author + dateline) TIDAK ada di textarea —
    // ia dirakit otomatis dari field form sehingga tidak bisa dirusak penulis.
    const content = dialog.locator('#blog-editor-content')
    await expect(content).toBeVisible()
    const value = await content.inputValue()
    expect(value).not.toContain('**Author :**')
    expect(value).not.toMatch(/^Sriwulan,/m)

    // Pratinjau menampilkan hasil rakitan penuh persis seperti yang disimpan.
    await dialog.locator('#blog-editor-title').fill('Uji Kerangka Terkunci')
    await dialog.getByRole('button', { name: 'Pratinjau' }).click()
    await expect(dialog).toContainText('Author :')
    await expect(dialog).toContainText('Sriwulan,')
    await expect(dialog).toContainText('Uji Kerangka Terkunci')

    // Toolbar sederhana: hanya Judul & Subjudul + sisip gambar.
    const toolbar = dialog.getByRole('toolbar', { name: 'Alat format tulisan' })
    await expect(toolbar.getByRole('button', { name: 'Judul', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Subjudul', exact: true })).toBeVisible()
    for (const removed of ['Tebal', 'Miring', 'Daftar', 'Kutipan', 'Tautan']) {
      await expect(toolbar.getByRole('button', { name: removed, exact: true })).toHaveCount(0)
    }
    await expect(toolbar.getByText('Sisipkan gambar ke isi')).toBeVisible()
  })
})
