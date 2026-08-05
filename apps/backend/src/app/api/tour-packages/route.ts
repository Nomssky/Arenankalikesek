import { NextRequest, NextResponse } from 'next/server'
import { loadResolvedTourCatalog } from '../../../lib/catalog'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  try {
    const catalog = await loadResolvedTourCatalog()
    const data = catalog.data.filter((item) => {
      if (category && category !== 'semua' && item.category !== category) return false
      if (available === 'true' && !item.available) return false
      return true
    })

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Data-Source': catalog.source,
      },
    })
  } catch (error) {
    console.error('Public tour catalog error:', error)
    return NextResponse.json(
      { error: 'Gagal memuat harga wisata dari database' },
      { status: 500 },
    )
  }
}