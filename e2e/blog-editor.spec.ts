import { test, expect } from '@playwright/test'

const password = process.env.E2E_ADMIN_PASSWORD

// Non-mutasi: membuka editor blog dari halaman publik, tidak menyimpan artikel.
test.describe('Editor blog ramah pengelola', () => {
  test('pengunjung melihat tombol Kelola tetapi belum bisa menulis', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Kelola', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Tambah Reportase' })).toHaveCount(0)
  })

  test('admin login lalu editor menampilkan toolbar format & strip draf', async ({ page }) => {
    test.skip(!password, 'Butuh E2E_ADMIN_PASSWORD')
    await page.goto('/blog', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Kelola', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Masuk sebagai admin' })).toBeVisible()
    await page.locator('#blog-admin-password').fill(password!)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()

    const addButton = page.getByRole('button', { name: '+ Tambah Reportase' })
    await expect(addButton).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Draf (belum terbit)')).toBeVisible()

    await addButton.click()
    const toolbar = page.getByRole('toolbar', { name: 'Alat format tulisan' })
    await expect(toolbar).toBeVisible()
    for (const tool of ['Judul', 'Subjudul', 'Tebal', 'Miring', 'Daftar', 'Kutipan', 'Tautan']) {
      await expect(toolbar.getByRole('button', { name: tool, exact: true })).toBeVisible()
    }
    await expect(toolbar.getByText('Sisipkan gambar ke isi')).toBeVisible()

    // Artikel baru otomatis berisi templat format tetap reportase.
    const content = page.locator('#blog-editor-content')
    await expect(content).toBeVisible()
    const value = await content.inputValue()
    expect(value).toContain('**Author :**')
    expect(value).toMatch(/^Sriwulan, \d{1,2} \w+ \d{4} –/m)
  })
})
