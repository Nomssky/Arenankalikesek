import { expect, test, type Page, type TestInfo } from '@playwright/test'

type BrowserIssue = {
  type: 'console' | 'pageerror' | 'requestfailed'
  message: string
}

const viewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
]

const publicRoutes = [
  '/',
  '/wisata',
  '/toko',
  '/toko/checkout',
  '/blog',
  '/kontak',
  '/webgis',
  '/jadwal',
  '/booking/sukses',
  '/dashboard',
  '/eduwisata-gula-aren',
  '/blog/desa-wisata-arenan-kalikesek',
  '/blog/edukasi-pemanfaatan-maggot-desa-sriwulan',
  '/blog/fgd-peternak-domba-desa-sriwulan',
  '/blog/membuat-paving-block-dari-sampah-plastik-bisa-menjadi-solusi-ramah-lingkungan',
  '/blog/REPORTASE_GLAMPING_KALIKESEK_REVISI',
  '/blog/REPORTASE_INCINERATOR_KELOMPOK_1_REVISI',
  '/blog/terapi-ikan-kalikesek',
  '/admin/login',
]

const protectedAdminRoutes = [
  '/admin',
  '/admin/bookings',
  '/admin/jadwal',
  '/admin/booking-settings',
  '/admin/products',
  '/admin/tour-packages',
  '/admin/inventory',
]

function collectBrowserIssues(page: Page) {
  const issues: BrowserIssue[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({ type: 'console', message: message.text() })
    }
  })
  page.on('pageerror', (error) => {
    issues.push({ type: 'pageerror', message: error.message })
  })
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText || 'gagal'
    if (reason.includes('ERR_ABORTED')) return
    issues.push({
      type: 'requestfailed',
      message: `${request.method()} ${request.url()} - ${reason}`,
    })
  })

  return issues
}

async function attachAudit(testInfo: TestInfo, audit: unknown) {
  await testInfo.attach('ui-audit', {
    body: JSON.stringify(audit, null, 2),
    contentType: 'application/json',
  })
}

async function pageHealth(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    const brokenImages = [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || image.alt)
    const isVisible = (element: Element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const hasAccessibleName = (element: Element) => {
      const ariaLabelledBy = element.getAttribute('aria-labelledby')
      const labelledText = ariaLabelledBy
        ? ariaLabelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ')
        : ''
      return Boolean(
        element.getAttribute('aria-label')?.trim()
        || labelledText.trim()
        || element.getAttribute('title')?.trim()
        || element.textContent?.trim()
        || element.querySelector('img[alt]:not([alt=""])'),
      )
    }
    const unnamedControls = [...document.querySelectorAll('button, a[href]')]
      .filter((element) => isVisible(element) && !hasAccessibleName(element))
      .map((element) => `${element.tagName.toLowerCase()} ${element.getAttribute('href') || element.className}`)
    const unlabeledFields = [...document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]), select, textarea')]
      .filter((element) => {
        if (!isVisible(element)) return false
        const id = element.getAttribute('id')
        return !element.getAttribute('aria-label')
          && !element.getAttribute('aria-labelledby')
          && !element.closest('label')
          && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
      })
      .map((element) => `${element.tagName.toLowerCase()} ${element.getAttribute('type') || ''} ${element.getAttribute('name') || ''}`)
    const previousScrollX = window.scrollX
    window.scrollTo({ left: 100_000, behavior: 'instant' })
    const horizontalOverflow = window.scrollX
    window.scrollTo({ left: previousScrollX, behavior: 'instant' })
    return {
      horizontalOverflow,
      brokenImages,
      unnamedControls,
      unlabeledFields,
      h1Count: document.querySelectorAll('h1').length,
    }
  })
}

test.describe('Audit UI non-destruktif', () => {
  for (const viewport of viewports) {
    test(`semua route sehat pada ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(120_000)
      await page.setViewportSize(viewport)
      const issues = collectBrowserIssues(page)
      const audit: Array<Record<string, unknown>> = []

      for (const route of publicRoutes) {
        const issueStart = issues.length
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(250)
        const health = await pageHealth(page)
        const routeIssues = issues.slice(issueStart)
        audit.push({ route, status: response?.status(), ...health, issues: routeIssues })

        expect.soft(response?.status(), `${route} tidak merespons sukses`).toBeLessThan(400)
        expect.soft(health.horizontalOverflow, `${route} dapat digeser horizontal ${health.horizontalOverflow}px`).toBe(0)
        expect.soft(health.brokenImages, `${route} memiliki gambar rusak`).toEqual([])
        expect.soft(health.unnamedControls, `${route} memiliki kontrol tanpa nama aksesibel`).toEqual([])
        expect.soft(health.unlabeledFields, `${route} memiliki field tanpa label aksesibel`).toEqual([])
        expect.soft(health.h1Count, `${route} memiliki lebih dari satu h1`).toBeLessThanOrEqual(1)
        expect.soft(routeIssues, `${route} memiliki error browser`).toEqual([])
      }

      await attachAudit(testInfo, audit)
    })
  }

  test('route admin terlindungi dan mempertahankan tujuan redirect', async ({ page }) => {
    for (const route of protectedAdminRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      const currentUrl = new URL(page.url())
      expect(currentUrl.pathname).toBe('/admin/login')
      expect(currentUrl.searchParams.get('redirect')).toBe(route)
      await expect(page.getByRole('heading', { name: /Admin|Masuk/i })).toBeVisible()
    }
  })

  test('menu mobile dapat dibuka, ditutup, dan bernavigasi', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const trigger = page.getByRole('button', { name: /menu/i })
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.click()
    await page.locator('header').getByRole('link', { name: 'Blog', exact: true }).click()
    await expect(page).toHaveURL(/\/blog$/)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  test('blog menampilkan artikel lengkap tanpa pencarian dan detail dapat dibuka', async ({ page }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('input[type="search"]')).toHaveCount(0)
    await expect(page.getByPlaceholder(/cari artikel/i)).toHaveCount(0)
    const cards = page.locator('article')
    expect(await cards.count()).toBeGreaterThan(0)
    const title = cards.first().locator('h2')
    await expect(title).toBeVisible()
    expect(await title.getAttribute('class')).not.toMatch(/line-clamp/)
    await cards.first().getByRole('link', { name: /Baca artikel/i }).click()
    await expect(page.locator('main article h1, main h1').first()).toBeVisible()
  })

  test('invoice yang tidak ditemukan menampilkan pesan terkendali', async ({ page }) => {
    await page.goto('/invoice/audit-id-tidak-ada', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Invoice tidak ditemukan|Invoice gagal dimuat|Gagal memuat invoice/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kembali', exact: true })).toBeVisible()
  })

  test('invoice cache lama tetap dapat dibuka dengan data string yang valid', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('invoice_audit-cache', JSON.stringify({
        id: 'audit-cache',
        booking_code: 'BKK-AUDIT-001',
        customer_name: 'Pengguna Uji',
        customer_phone: '081234567890',
        type: 'wisata',
        status: 'confirmed',
        payment_status: 'paid',
        total_amount: '50000',
        items: '[{"id":"area-outbound","name":"Area Outbound","quantity":"2","price":"25000"}]',
        booking_date: '2026-08-10',
        created_at: '2026-08-04T03:00:00.000Z',
      }))
    })
    await page.goto('/invoice/audit-cache', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'INVOICE' })).toBeVisible()
    await expect(page.getByText('BKK-AUDIT-001')).toBeVisible()
    await expect(page.getByText('Area Outbound')).toBeVisible()
    await expect(page.getByText('Rp50.000').last()).toBeVisible()
  })

  test('halaman 404 memberi jalan kembali tanpa merusak layout', async ({ page }) => {
    const response = await page.goto('/route-audit-yang-tidak-ada', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('link', { name: /Kembali|Beranda|Home/i }).first()).toBeVisible()
    const health = await pageHealth(page)
    expect(health.horizontalOverflow).toBe(0)
    expect(health.brokenImages).toEqual([])
  })

  test('seluruh tautan internal dari halaman utama tidak menghasilkan 404', async ({ page }) => {
    const sources = ['/', '/wisata', '/toko', '/blog', '/kontak', '/webgis', '/jadwal']
    const internalPaths = new Set<string>()
    const origin = new URL(test.info().project.use.baseURL as string).origin
    for (const source of sources) {
      await page.goto(source, { waitUntil: 'domcontentloaded' })
      for (const href of await page.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
        if (!href) continue
        const url = new URL(href, origin)
        if (url.origin === origin) internalPaths.add(`${url.pathname}${url.search}`)
      }
    }
    for (const path of internalPaths) {
      const response = await page.request.get(path, { maxRedirects: 5 })
      expect(response.status(), `${path} menghasilkan status ${response.status()}`).toBeLessThan(400)
    }
  })

  test('login admin menolak kata sandi salah dengan pesan yang jelas', async ({ page }) => {
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Kata sandi').fill('kata-sandi-audit-yang-salah')
    await page.getByRole('button', { name: 'Masuk' }).click()
    await expect(page.getByText(/Password salah|Kata sandi salah|tidak valid|Login admin belum dikonfigurasi/i)).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('halaman Jadwal menyelesaikan loading data tanpa error browser', async ({ page }, testInfo) => {
    const issues = collectBrowserIssues(page)
    const responses: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/api/')) responses.push(`${response.status()} ${response.url()}`)
    })

    await page.goto('/jadwal', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.animate-spin')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.locator('article').first()).toBeVisible()
    await attachAudit(testInfo, { responses, issues })
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([])
  })
})
