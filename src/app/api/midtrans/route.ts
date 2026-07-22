import { NextRequest, NextResponse } from 'next/server'
import { checkTransactionStatus } from '@/lib/midtrans'
import { getSupabaseAdmin } from '@/lib/supabase-server'

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

    const transactionStatus = status.transaction_status
    let bookingStatus = 'pending'

    if (
      transactionStatus === 'settlement' ||
      transactionStatus === 'capture'
    ) {
      bookingStatus = 'paid'
    } else if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
      bookingStatus = 'cancelled'
    } else if (transactionStatus === 'pending') {
      bookingStatus = 'pending'
    }

    const supabase = getSupabaseAdmin() as any
    await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_method: status.payment_type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    return NextResponse.json({
      orderId,
      transactionStatus,
      bookingStatus,
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

  const { transaction_status, order_id, payment_type, gross_amount } = body

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  let bookingStatus = 'pending'
  if (
    transaction_status === 'settlement' ||
    transaction_status === 'capture'
  ) {
    bookingStatus = 'paid'
  } else if (
    transaction_status === 'deny' ||
    transaction_status === 'expire' ||
    transaction_status === 'cancel'
  ) {
    bookingStatus = 'cancelled'
  }

  const supabase = getSupabaseAdmin() as any
  await supabase
    .from('bookings')
    .update({
      status: bookingStatus,
      payment_method: payment_type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  return NextResponse.json({
    status: 'ok',
    booking_id: order_id,
    booking_status: bookingStatus,
  })
}
