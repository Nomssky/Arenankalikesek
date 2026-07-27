import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

interface ProductRow {
  id: string
  name: string
  price: number
  category: string
  image: string
  description: string
  unit: string
  available: boolean
  sort_order: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const available = searchParams.get('available')

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })

    if (category && category !== 'semua') {
      query = query.eq('category', category)
    }
    if (available === 'true') {
      query = query.eq('available', true)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Gagal memuat produk' }, { status: 500 })
    }

    let result: ProductRow[] = data || []

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p: ProductRow) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Fetch products error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
