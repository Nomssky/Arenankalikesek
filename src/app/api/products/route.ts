import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { fallbackProducts } from '@/lib/fallback-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')?.toLowerCase().trim()
  const available = searchParams.get('available')

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      let query = supabase.from('products').select('*')

      if (category && category !== 'semua') {
        query = query.eq('category', category)
      }
      if (available === 'true') {
        query = query.eq('available', true)
      }

      const { data, error } = await query.order('sort_order', { ascending: true })
      if (!error && data && data.length > 0) {
        let result = data
        if (search) {
          result = data.filter(
            (p: { name: string; description?: string }) =>
              p.name.toLowerCase().includes(search) ||
              (p.description || '').toLowerCase().includes(search),
          )
        }
        return NextResponse.json(result, {
          headers: { 'X-Data-Source': 'supabase' },
        })
      }
    } catch (e) {
      console.error('Supabase products error, using fallback:', e)
    }
  }

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
