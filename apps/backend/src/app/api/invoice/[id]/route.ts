import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'
import { verifySessionToken } from '../../../../lib/admin-auth'
import { digits } from '../../../../lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const phone = digits(request.nextUrl.searchParams.get('phone'))
  const adminToken = request.cookies.get('admin_token')?.value
  const isAdmin = adminToken ? await verifySessionToken(adminToken) : false

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
  }

  try {
    const supabase = getSupabaseAdmin()

    await supabase.rpc('expire_stale_booking_holds')

    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_code, customer_name, customer_phone, customer_email, customer_address, type, status, payment_status, payment_method, payment_url, total_amount, items, booking_date, created_at, expires_at, notes, booking_mode, check_in_date, check_out_date, nights, guest_count, accommodation_type, pricing_details')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Gagal memuat invoice' }, { status: 500 })
    }

    if (!isAdmin && (!phone || phone !== digits(data.customer_phone))) {
      return NextResponse.json({ error: 'Nomor telepon tidak cocok' }, { status: 403 })
    }

    if (!isAdmin && data.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Invoice tersedia setelah pembayaran berhasil' },
        { status: 409 },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Invoice fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
