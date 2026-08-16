import { test, expect } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'

test('webgis: tiga iframe peta memuat leaflet tanpa error', async ({ page }) => {
  await page.goto('/webgis')
  await page.getByRole('heading', { name: 'Peta Penduduk' }).waitFor()
  await expect
    .poll(() => page.frames().filter((f) => f.url().includes('/webgis/')).length, { timeout: 20000 })
    .toBe(3)
  const frames = page.frames().filter((f) => f.url().includes('/webgis/'))
  expect(frames.length).toBe(3)
  for (const frame of frames) {
    await expect
      .poll(async () => frame.locator('.leaflet-container').count(), { timeout: 15000 })
      .toBeGreaterThan(0)
    const layers = await frame.locator('.leaflet-layer').count()
    expect(layers).toBeGreaterThan(0)
  }
})

test('homepage: video memakai sumber lokal', async ({ page }) => {
  await page.goto('/')
  const src = await page.locator('video source').getAttribute('src')
  expect(src).toBe('/videos/drone-kalikesek.mp4')
})
