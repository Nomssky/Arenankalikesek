import { test, expect, type Page } from '@playwright/test'

// Editor reportase: admin menambah/mengedit/menghapus langsung di halaman blog
// dengan password admin yang sama. Mutasi (self-cleaning): data uji ber-prefix
// E2E- dan dihapus di test kedua; hanya deterministik di localhost.

const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const mutationsEnabled = process.env.E2E_ENABLE_MUTATIONS === 'true'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const TITLE = `E2E Reportase ${Date.now()}`
const SLUG = slugify(TITLE)

test.describe('Editor reportase di halaman blog', () => {
  test.skip(!ADMIN_PASSWORD, 'E2E_ADMIN_PASSWORD belum disediakan untuk akun pengujian resmi')
  test.skip(!mutationsEnabled, 'butuh E2E_ENABLE_MUTATIONS=true (localhost)')

  async function loginViaModal(page: Page) {
    await page.getByRole('button', { name: 'Kelola', exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Masuk sebagai admin' })
    await expect(modal).toBeVisible()
    await modal.getByLabel('Password admin').fill(ADMIN_PASSWORD || '')
    await modal.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(modal).toHaveCount(0, { timeout: 10000 })
  }

  test('admin menambah reportase dari halaman blog', async ({ page }) => {
    await page.goto('/blog')
    await loginViaModal(page)
    await page.getByRole('button', { name: '+ Tambah Reportase' }).click()
    const editor = page.getByRole('dialog', { name: 'Tambah Reportase' })
    await expect(editor).toBeVisible()
    await editor.getByLabel('Judul *').fill(TITLE)
    await editor.getByLabel('Isi artikel (markdown) *').fill('Isi artikel uji E2E.')
    await editor.getByRole('button', { name: 'Simpan', exact: true }).click()
    await expect(editor).toHaveCount(0, { timeout: 10000 })
    await expect(
      page.getByRole('link', { name: `Baca artikel ${TITLE}` }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('artikel uji tampil di detail dan dapat dihapus (self-cleaning)', async ({ page }) => {
    await page.goto(`/blog/${SLUG}`)
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({ timeout: 10000 })
    await loginViaModal(page)
    await page.getByRole('button', { name: 'Hapus', exact: true }).click()
    await page.getByRole('button', { name: 'Yakin hapus?' }).click()
    await expect(page.getByText('Halaman tidak ditemukan')).toBeVisible({ timeout: 10000 })
  })
})