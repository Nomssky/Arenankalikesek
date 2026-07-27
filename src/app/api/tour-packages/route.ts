import { NextRequest, NextResponse } from 'next/server'
import { fallbackTourPackages } from '@/lib/fallback-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  const data = fallbackTourPackages.filter((item) => {
    if (category && category !== 'semua' && item.category !== category) return false
    if (available === 'true' && !item.available) return false
    return true
  })

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': 'central-pricing' },
  })
}
