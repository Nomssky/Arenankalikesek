import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_status, order_id, payment_type } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }

    let bookingStatus = 'pending'
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      bookingStatus = 'paid'
    } else if (
      transaction_status === 'deny' ||
      transaction_status === 'expire' ||
      transaction_status === 'cancel'
    ) {
      bookingStatus = 'cancelled'
    }

    const supabase = getSupabaseAdmin() as any
    const { error } = await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_method: payment_type || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
