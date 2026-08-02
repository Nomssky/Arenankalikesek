import { NextRequest, NextResponse } from 'next/server'
import { fallbackProducts } from '../../../lib/fallback-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')?.toLowerCase().trim()
  const available = searchParams.get('available')

  const data = fallbackProducts.filter((product) => {
    if (category && category !== 'semua' && product.category !== category) return false
    if (available === 'true' && !product.available) return false
    if (
      search &&
      !product.name.toLowerCase().includes(search) &&
      !product.description.toLowerCase().includes(search)
    ) {
      return false
    }
    return true
  })

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': 'central-pricing' },
  })
}
