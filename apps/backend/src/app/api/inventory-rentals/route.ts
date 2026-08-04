import { NextRequest, NextResponse } from 'next/server'
import { fallbackInventoryItems } from '../../../lib/fallback-data'
import { inventoryPriceLabel, inventoryVenues } from '../../../lib/inventory'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  const liveVenues = await inventoryVenues()
  const sourceItems = liveVenues.length
    ? liveVenues.map((item) => ({
        id: item.id,
        name: item.name,
        description: '',
        category: item.category,
        price_per_unit: item.price,
        price_type: item.price_type,
        price_label: inventoryPriceLabel(item),
        capacity: null,
        stock: 1,
        image: item.image,
        available: item.available,
      }))
    : fallbackInventoryItems

  const data = sourceItems
    .filter((item) => {
      if (category && item.category !== category) return false
      if (available === 'true' && !item.available) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': liveVenues.length ? 'inventory-db' : 'central-pricing' },
  })
}