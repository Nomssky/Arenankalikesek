import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { fallbackTourPackages } from '@/lib/fallback-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      let query = supabase.from('tour_packages').select('*')

      if (category && category !== 'semua') {
        query = query.eq('category', category)
      }
      if (available === 'true') {
        query = query.eq('available', true)
      }

      const { data, error } = await query.order('sort_order', { ascending: true })
      if (!error && data && data.length > 0) {
        return NextResponse.json(data, {
          headers: { 'X-Data-Source': 'supabase' },
        })
      }
    } catch (e) {
      console.error('Supabase tour-packages error, using fallback:', e)
    }
  }

  const data = fallbackTourPackages.filter((item) => {
    if (category && category !== 'semua' && item.category !== category) return false
    if (available === 'true' && !item.available) return false
    return true
  })

  return NextResponse.json(data, {
    headers: { 'X-Data-Source': 'central-pricing' },
  })
}
