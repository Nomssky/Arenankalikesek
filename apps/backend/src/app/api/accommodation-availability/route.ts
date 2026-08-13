import { NextRequest, NextResponse } from 'next/server'
import { addDateDays } from '@repo/shared-utils'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase-server'

const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/

function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = `${month}-01`
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10)
  return { start, next }
}

function datesFromRange(start: string, end: string, monthStart: string, monthNext: string) {
  const first = start < monthStart ? monthStart : start
  const last = end > monthNext ? monthNext : end
  const result: string[] = []
  for (let current = first; current < last; current = addDateDays(current, 1)) result.push(current)
  return result
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get('item_id')?.trim()
  // Default bulan mengikuti zona WIB (bukan UTC server) agar tanggal berganti
  // tepat tengah malam bagi pengguna. sv-SE memberi format YYYY-MM-DD.
  const month = searchParams.get('month')?.trim() ||
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
  if (!itemId || !MONTH_FORMAT.test(month)) {
    return NextResponse.json({ error: 'Item dan bulan wajib valid' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ itemId, month, blockedDates: [], holidayDates: [], source: 'local' })
  }

  try {
    const supabase = getSupabaseAdmin()
    await supabase.rpc('expire_stale_booking_holds')
    const { start, next } = monthBounds(month)
    const [reservations, blocks, holidays] = await Promise.all([
      supabase
        .from('accommodation_bookings')
        .select('check_in_date, check_out_date')
        .eq('item_id', itemId)
        .in('status', ['hold', 'active'])
        .lt('check_in_date', next)
        .gt('check_out_date', start),
      supabase
        .from('booking_date_blocks')
        .select('start_date, end_date')
        .eq('item_id', itemId)
        .eq('active', true)
        .lt('start_date', next)
        .gt('end_date', start),
      supabase
        .from('booking_holiday_dates')
        .select('holiday_date, label')
        .eq('active', true)
        .gte('holiday_date', start)
        .lt('holiday_date', next),
    ])

    if (reservations.error || blocks.error || holidays.error) {
      console.error('Accommodation availability error:', reservations.error || blocks.error || holidays.error)
      return NextResponse.json({ error: 'Gagal memuat ketersediaan penginapan' }, { status: 500 })
    }

    const blockedDates = new Set<string>()
    for (const row of reservations.data || []) {
      for (const date of datesFromRange(row.check_in_date, row.check_out_date, start, next)) blockedDates.add(date)
    }
    for (const row of blocks.data || []) {
      for (const date of datesFromRange(row.start_date, row.end_date, start, next)) blockedDates.add(date)
    }

    return NextResponse.json({
      itemId,
      month,
      blockedDates: [...blockedDates].sort(),
      holidayDates: (holidays.data || []).map((row) => row.holiday_date),
    })
  } catch (error) {
    console.error('Accommodation availability error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
