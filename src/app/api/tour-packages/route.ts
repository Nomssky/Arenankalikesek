import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const available = searchParams.get('available')

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('tour_packages')
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
      return NextResponse.json({ error: 'Gagal memuat paket wisata' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Fetch tour packages error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
