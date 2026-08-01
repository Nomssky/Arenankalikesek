import { NextRequest, NextResponse } from 'next/server'
import { fallbackTourPackages } from '@/lib/fallback-data'
import { loadBookingSettings } from '@/lib/booking-settings'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  const settings = await loadBookingSettings()
  const glampingPrice = settings['camping.glamping_base_price']
  const configuredPackages = fallbackTourPackages.map((item) => {
    if (item.id === 'camping-ground') {
      const smallPrice = settings['camping.small_tent_price'] ?? 20000
      const largePrice = settings['camping.large_tent_price'] ?? 50000
      return {
        ...item,
        price: smallPrice,
        max_price: largePrice,
        price_label: `Rp${smallPrice.toLocaleString('id-ID')}–Rp${largePrice.toLocaleString('id-ID')}`,
      }
    }
    if (item.id !== 'glamping' || glampingPrice === null || glampingPrice === undefined) return item
    return {
      ...item,
      price: glampingPrice,
      max_price: null,
      price_label: `Rp${glampingPrice.toLocaleString('id-ID')}`,
      pricing_type: 'fixed' as const,
      unit: 'malam',
      bookable: true,
    }
  })
  const data = configuredPackages.filter((item) => {
    if (category && category !== 'semua' && item.category !== category) return false
    if (available === 'true' && !item.available) return false
    return true
  })

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': 'central-pricing' },
  })
}
