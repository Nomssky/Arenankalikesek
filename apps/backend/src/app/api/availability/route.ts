import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { item_id, start_at, end_at } = body

    if (!item_id || typeof item_id !== 'string') {
      return NextResponse.json(
        { error: 'item_id diperlukan' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('rental_bookings')
      .select('id, booking_date, time_start, time_end, status', { count: 'exact', head: false })
      .eq('item_id', item_id)
      .neq('status', 'cancelled')

    if (start_at) {
      query = query.gte('booking_date', start_at)
    }
    if (end_at) {
      query = query.lte('booking_date', end_at)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Availability check error:', error)
      return NextResponse.json({ error: 'Gagal memeriksa ketersediaan' }, { status: 500 })
    }

    return NextResponse.json({
      item_id,
      available: count === 0,
      data: data || [],
    })
  } catch (error) {
    console.error('Availability error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
