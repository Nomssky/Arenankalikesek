import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { fallbackInventoryItems } from '@/lib/fallback-data'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin()
      let query = supabase.from('inventory_rentals').select('*')

      if (category) {
        query = query.eq('category', category)
      }
      if (available === 'true') {
        query = query.eq('available', true)
      }

      const { data, error } = await query.order('name', { ascending: true })
      if (!error && data && data.length > 0) {
        return NextResponse.json(data, {
          headers: { 'X-Data-Source': 'supabase' },
        })
      }
    } catch (e) {
      console.error('Supabase inventory-rentals error, using fallback:', e)
    }
  }

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
