import { NextRequest, NextResponse } from 'next/server'
import { fallbackTourPackages } from '../../../lib/fallback-data'
import { loadBookingSettings } from '../../../lib/booking-settings'
import {
  inventoryPriceLabel,
  inventoryUnit,
  inventoryVenues,
} from '../../../lib/inventory'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  const settings = await loadBookingSettings()
  const glampingPrice = settings['camping.glamping_base_price']
  const liveVenues = await inventoryVenues()
  const liveVenueMap = new Map(liveVenues.map((item) => [item.id, item]))
  const data = fallbackTourPackages
    .map((item) => {
      const live = liveVenueMap.get(item.id)
      if (live) {
        return {
          ...item,
          name: live.name,
          category: live.category,
          price: live.price,
          max_price: null,
          price_label: inventoryPriceLabel(live),
          pricing_type: 'fixed' as const,
          unit: inventoryUnit(live.price_type),
          available: live.available,
          bookable: live.available,
        }
      }
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
    .filter((item) => {
      if (category && category !== 'semua' && item.category !== category) return false
      if (available === 'true' && !item.available) return false
      return true
    })

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': liveVenues.length ? 'inventory-db' : 'central-pricing' },
  })
}
