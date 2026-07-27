import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  if (!isSupabaseConfigured()) {
    return NextResponse.json([], {
      headers: { 'X-Data-Source': 'local-fallback' },
    })
  }

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('bookings')
      .select('items,time_start,time_end,booking_date,status')
      .neq('status', 'cancelled')

    if (startDate) query = query.gte('booking_date', startDate)
    if (endDate) query = query.lte('booking_date', endDate)

    const { data, error } = await query

    if (error) {
      console.error('Fetch public schedule error:', error)
      return NextResponse.json({ error: 'Gagal memuat jadwal' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Fetch public schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
