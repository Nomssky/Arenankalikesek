import { NextRequest, NextResponse } from 'next/server'
import { loadBookingSettings } from '../../../lib/booking-settings'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase-server'

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/
const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || ''
  // Default bulan mengikuti zona WIB (bukan UTC server) agar tanggal berganti
  // tepat tengah malam bagi pengguna. sv-SE memberi format YYYY-MM-DD.
  const month = searchParams.get('month') || date.slice(0, 7) ||
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
  if ((date && !DATE_FORMAT.test(date)) || !MONTH_FORMAT.test(month)) {
    return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
  }

  const settings = await loadBookingSettings()
  const quota = settings['edu_trip.daily_quota'] ?? 2
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ quota, used: date ? 0 : undefined, remaining: date ? quota : undefined, byDate: {} })
  }

  try {
    const supabase = getSupabaseAdmin()
    await supabase.rpc('expire_stale_booking_holds')
    const [year, monthNumber] = month.split('-').map(Number)
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('edu_trip_reservations')
      .select('booking_date')
      .in('status', ['hold', 'active'])
      .gte('booking_date', `${month}-01`)
      .lt('booking_date', nextMonth)

    if (error) {
      console.error('Edu Trip availability error:', error)
      return NextResponse.json({ error: 'Gagal memuat kuota Edu Trip' }, { status: 500 })
    }

    const byDate: Record<string, number> = {}
    for (const row of data || []) byDate[row.booking_date] = (byDate[row.booking_date] || 0) + 1
    const used = date ? byDate[date] || 0 : undefined
    return NextResponse.json({ quota, used, remaining: date ? Math.max(0, quota - (used || 0)) : undefined, byDate })
  } catch (error) {
    console.error('Edu Trip availability error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
