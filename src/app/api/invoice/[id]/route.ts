import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
  }

  try {
    const supabase = getSupabaseAdmin()

    await supabase
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'unpaid', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_code, customer_name, customer_phone, customer_email, customer_address, type, status, payment_status, payment_method, total_amount, items, booking_date, created_at, notes')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Gagal memuat invoice' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Invoice fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
