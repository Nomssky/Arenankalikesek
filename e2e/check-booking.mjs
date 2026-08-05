import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage()

// /jadwal - accommodation tab: check the unit dropdown options
await page.goto('http://localhost:3000/jadwal', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Penginapan & Camping' }).click()
await page.waitForTimeout(1500)
const unitOptions = await page.getByLabel('Unit penginapan atau camping').locator('option').allTextContents()
console.log('JADWAL accommodation unit options:', JSON.stringify(unitOptions))

// /booking/wisata - penginapan & camping listing: add-ons must not leak
await page.goto('http://localhost:3000/booking/wisata?category=penginapan-camping', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const extraBedCards = await page.locator('article', { hasText: 'Extra Bed (100x220)' }).count()
const overKapasitasCards = await page.locator('article', { hasText: 'Over Kapasitas' }).count()
console.log('LISTING leak extra-bed:', extraBedCards, 'over-kapasitas:', overKapasitasCards)

// /booking/wisata - add a UUID camping item and check the stay form appears
const spotTenda = page.locator('article', { hasText: 'Spot Tenda' }).first()
console.log('Spot Tenda card count:', await spotTenda.count())
if (await spotTenda.count() > 0) {
  await spotTenda.getByRole('button', { name: /Tambah/ }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Pilihan Booking' }).click()
  await page.waitForTimeout(1500)
  const cartText = await page.locator('[role="dialog"]').first().innerText().catch(() => '(no dialog)')
  console.log('CAMPING cart shows unit count label:', cartText.includes('1 unit'))
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Isi keterangan booking' }).click()
  await page.waitForTimeout(1200)
  const formText = await page.locator('[role="dialog"]').first().innerText().catch(() => '(no form)')
  console.log('CAMPING form shows Tanggal menginap:', formText.includes('Tanggal menginap'))
  console.log('CAMPING form shows Jumlah tamu:', formText.includes('Jumlah tamu'))
  await page.getByRole('button', { name: 'Tutup checkout' }).click()
  await page.waitForTimeout(800)
}

// add Aren 1 homestay and check the homestay stay form
const arenCard = page.locator('article', { hasText: 'Aren 1 (2-5 org)' })
console.log('Aren 1 card count:', await arenCard.count())
if (await arenCard.count() > 0) {
  await arenCard.first().getByRole('button', { name: /Tambah/ }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Pilihan Booking' }).click()
  await page.waitForTimeout(1500)
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Isi keterangan booking' }).click()
  await page.waitForTimeout(1200)
  const formText = await page.locator('[role="dialog"]').first().innerText().catch(() => '(no form)')
  console.log('HOMESTAY form shows Tanggal menginap:', formText.includes('Tanggal menginap'))
  console.log('HOMESTAY form shows Jumlah tamu utama:', formText.includes('Jumlah tamu utama'))
  console.log('HOMESTAY form shows Add-on homestay:', formText.includes('Add-on homestay'))
}

await browser.close()
