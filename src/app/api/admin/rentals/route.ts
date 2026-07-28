import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const status = searchParams.get('status')

  if (!isSupabaseConfigured()) {
    return NextResponse.json([])
  }

  try {
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('rental_bookings')
      .select(`
        id,
        booking_id,
        item_id,
        quantity,
        booking_date,
        time_start,
        time_end,
        total_price,
        status,
        created_at,
        inventory_rentals ( name, category ),
        bookings ( customer_name, customer_phone, booking_code )
      `)
      .order('created_at', { ascending: false })

    if (startDate) query = query.gte('booking_date', startDate)
    if (endDate) query = query.lte('booking_date', endDate)
    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      console.error('Fetch rentals error:', error)
      return NextResponse.json({ error: 'Gagal memuat data rental' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Fetch rentals error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
