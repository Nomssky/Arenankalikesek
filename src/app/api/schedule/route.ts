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
      .from('rental_bookings')
      .select('id, item_id, item_name, quantity, booking_date, time_start, time_end, total_price, status')
      .neq('status', 'cancelled')

    if (startDate) query = query.gte('booking_date', startDate)
    if (endDate) query = query.lte('booking_date', endDate)

    const { data, error } = await query

    if (error) {
      console.error('Fetch schedule error:', error)
      return NextResponse.json({ error: 'Gagal memuat jadwal' }, { status: 500 })
    }

    const mapped = (data || []).map((r: Record<string, unknown>) => ({
      item_id: r.item_id,
      item_name: r.item_name || '',
      time_start: r.time_start || '',
      time_end: r.time_end || '',
      booking_date: r.booking_date,
      status: r.status,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Fetch schedule error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
