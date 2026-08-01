import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth
  if (!isSupabaseConfigured()) return NextResponse.json([])

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  try {
    const supabase = getSupabaseAdmin()
    await supabase.rpc('expire_stale_booking_holds')
    let query = supabase
      .from('accommodation_bookings')
      .select(`id, booking_id, item_id, item_name, accommodation_type, check_in_date,
        check_out_date, nights, guest_count, tent_size, tent_count, tent_option,
        addons, total_price, status, created_at,
        bookings (customer_name, customer_phone, booking_code, status, document_type)`)
      .order('check_in_date', { ascending: true })
    if (startDate) query = query.gte('check_out_date', startDate)
    if (endDate) query = query.lte('check_in_date', endDate)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Gagal memuat jadwal penginapan' }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Admin accommodations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
