import { NextRequest, NextResponse } from 'next/server'
import { loadProductCatalog } from '../../../lib/catalog'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')?.toLowerCase().trim()
  const available = searchParams.get('available')

  try {
    const catalog = await loadProductCatalog()
    const data = catalog.data.filter((product) => {
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
      headers: {
        'Cache-Control': 'no-store',
        'X-Data-Source': catalog.source,
      },
    })
  } catch (error) {
    console.error('Public product catalog error:', error)
    return NextResponse.json(
      { error: 'Gagal memuat harga produk dari database' },
      { status: 500 },
    )
  }
}
