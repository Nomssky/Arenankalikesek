import { NextRequest, NextResponse } from 'next/server'
import { fallbackInventoryItems } from '../../../lib/fallback-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  const data = fallbackInventoryItems
    .filter((item) => {
      if (category && item.category !== category) return false
      if (available === 'true' && !item.available) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': 'central-pricing' },
  })
}
