import { NextRequest, NextResponse } from 'next/server'
import { checkTransactionStatus } from '@/lib/midtrans'
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
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId diperlukan' },
        { status: 400 }
      )
    }

    const status = await checkTransactionStatus(orderId)

    if (!status) {
      return NextResponse.json(
        { error: 'Gagal mengecek status transaksi' },
        { status: 500 }
      )
    }

    const { status: bookingStatus, payment_status } = mapMidtransStatus(
      status.transaction_status
    )

    const supabase = getSupabaseAdmin()
    await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_status,
        payment_method: status.payment_type || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    return NextResponse.json({
      orderId,
      transactionStatus: status.transaction_status,
      bookingStatus,
      paymentStatus: payment_status,
      paymentType: status.payment_type,
      grossAmount: status.gross_amount,
    })
  } catch (error) {
    console.error('Midtrans callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { transaction_status, order_id, payment_type } = body

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const { status: bookingStatus, payment_status } = mapMidtransStatus(
    transaction_status
  )

  const supabase = getSupabaseAdmin()
  await supabase
    .from('bookings')
    .update({
      status: bookingStatus,
      payment_status,
      payment_method: payment_type || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  return NextResponse.json({
    status: 'ok',
    booking_id: order_id,
    booking_status: bookingStatus,
    payment_status,
  })
}
