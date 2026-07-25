import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { BookingStatus, PaymentStatus } from '@/lib/types'

function mapMidtransStatus(transactionStatus: string): {
  status: BookingStatus
  payment_status: PaymentStatus
} {
  if (
    transactionStatus === 'settlement' ||
    transactionStatus === 'capture'
  ) {
    return { status: 'paid', payment_status: 'paid' }
  } else if (
    transactionStatus === 'deny' ||
    transactionStatus === 'expire' ||
    transactionStatus === 'cancel'
  ) {
    return { status: 'cancelled', payment_status: 'unpaid' }
  }
  return { status: 'pending', payment_status: 'unpaid' }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_status, order_id, payment_type } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }

    const { status: bookingStatus, payment_status } = mapMidtransStatus(
      transaction_status
    )

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_status,
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
