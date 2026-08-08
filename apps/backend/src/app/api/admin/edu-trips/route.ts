import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/admin-guard'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'

// Jadwal eduwisata & kegiatan admin: sumber sama dengan kalender kuota
// (`edu_trip_reservations`, hold+active) — termasuk baris hasil import jadwal
// spreadsheet (SPR-*, booking_mode 'standard'). Sebelumnya detail memakai
// `/api/bookings` difilter `booking_mode='edu_trip'` sehingga booking impor
// tampil "terisi" di kalender tapi kosong saat diklik. Ponytail: satu sumber
// data untuk kuota & detail; jangan mengembalikan filter `booking_mode`.
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
      .from('edu_trip_reservations')
      .select(
        `id, booking_id, booking_date, status,
        bookings!inner (booking_code, customer_name, customer_phone, booking_mode, notes, guest_count, items, payment_status, status)`,
      )
      .in('status', ['hold', 'active'])
      .order('booking_date', { ascending: true })
    if (startDate) query = query.gte('booking_date', startDate)
    if (endDate) query = query.lte('booking_date', endDate)
    const { data, error } = await query
    if (error) {
      console.error('Admin edu trips error:', error)
      return NextResponse.json({ error: 'Gagal memuat jadwal eduwisata' }, { status: 500 })
    }
return NextResponse.json(
      (data || []).map((row) => {
        const parent = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
        return {
          id: row.id,
          booking_id: row.booking_id,
          booking_date: row.booking_date,
          status: parent?.status ?? row.status,
          booking_code: parent?.booking_code ?? null,
          customer_name: parent?.customer_name ?? null,
          customer_phone: parent?.customer_phone ?? null,
          booking_mode: parent?.booking_mode ?? null,
          payment_status: parent?.payment_status ?? null,
          guest_count: parent?.guest_count ?? null,
          items: parent?.items ?? null,
          notes: parent?.notes ?? null,
        }
      }),
    )
  } catch (error) {
    console.error('Admin edu trips error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}