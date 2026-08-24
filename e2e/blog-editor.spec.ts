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

  // Middleware /admin/* mengarahkan tamu tanpa cookie admin_token ke
  // /admin/login (pola sama dengan seluruh halaman panel admin).
  test('tamu tanpa sesi dialihkan ke login di /admin/blog', async ({ page }) => {
    await page.goto('/admin/blog', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 })
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

    // Pratinjau langsung berdampingan: hasil rakitan penuh tampil tanpa klik,
    // persis seperti yang akan disimpan.
    await dialog.locator('#blog-editor-title').fill('Uji Kerangka Terkunci')
    await expect(dialog).toContainText('Author :')
    await expect(dialog).toContainText('Sriwulan,')
    await expect(dialog).toContainText('Uji Kerangka Terkunci')

    // Chip kategori selalu terlihat (pengganti datalist yang tak andal);
    // klik chip mengisi input, teks tetap bebas diubah.
    const kategoriChip = dialog.getByRole('button', { name: 'Info Wisata' })
    await expect(kategoriChip).toBeVisible()
    await kategoriChip.click()
    await expect(dialog.locator('#blog-editor-category')).toHaveValue('Info Wisata')

    // Kolom link sampul menerima path relatif /images/… (type="text", bukan url).
    const sampul = dialog.locator('#blog-editor-image')
    await sampul.fill('/images/sosmas-1-1.png')
    await expect(sampul).toHaveValue('/images/sosmas-1-1.png')

    // Toolbar: Judul, Subjudul, Tebal + sisip gambar.
    const toolbar = dialog.getByRole('toolbar', { name: 'Alat format tulisan' })
    await expect(toolbar.getByRole('button', { name: 'Judul', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Subjudul', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Tebal', exact: true })).toBeVisible()
    for (const removed of ['Miring', 'Daftar', 'Kutipan', 'Tautan']) {
      await expect(toolbar.getByRole('button', { name: removed, exact: true })).toHaveCount(0)
    }
    await expect(toolbar.getByText('Sisipkan gambar ke isi')).toBeVisible()
  })
})
