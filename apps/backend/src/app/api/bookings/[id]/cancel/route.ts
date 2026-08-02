import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase-server'

function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Not available in offline mode' }, { status: 503 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, payment_status, customer_phone')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 })
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Booking sudah diproses dan tidak bisa dibatalkan' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => null)
    const phone = digits(body?.phone)
    if (!phone || phone !== digits(existing.customer_phone)) {
      return NextResponse.json({ error: 'Nomor WhatsApp tidak cocok dengan data booking' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        payment_status: 'unpaid',
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Cancel booking error:', updateError)
      return NextResponse.json({ error: 'Gagal membatalkan booking' }, { status: 500 })
    }

    await supabase
      .from('rental_bookings')
      .update({ status: 'cancelled' })
      .eq('booking_id', id)
      .neq('status', 'returned')

    return NextResponse.json({ status: 'cancelled' })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
