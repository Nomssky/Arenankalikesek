import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'
import { verifyMidtransNotification, mapMidtransStatus } from '../../../../lib/midtrans'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      order_id: orderId,
      transaction_status: transactionStatus,
      payment_type: paymentType,
      fraud_status: fraudStatus,
      gross_amount: grossAmount,
      transaction_id: transactionId,
      status_code: statusCode,
      signature_key: signatureKey,
    } = body

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!verifyMidtransNotification(orderId, statusCode, grossAmount, signatureKey)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ status: 'ok' })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing } = await supabase
      .from('bookings')
      .select('payment_status, total_amount')
      .eq('id', orderId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const webhookAmount = Math.round(Number(grossAmount))
    if (!Number.isFinite(webhookAmount) || webhookAmount !== Math.round(Number(existing.total_amount))) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    if (existing.payment_status === 'paid' && transactionStatus !== 'refund') {
      return NextResponse.json({ status: 'already_processed' })
    }

    const { bookingStatus, paymentStatus } = mapMidtransStatus(transactionStatus)

    const updateData: Record<string, unknown> = {
      status: bookingStatus,
      payment_status: paymentStatus,
      payment_method: paymentType || null,
      transaction_id: transactionId || null,
      updated_at: new Date().toISOString(),
    }

    if (fraudStatus === 'deny') {
      updateData.status = 'cancelled'
      updateData.payment_status = 'unpaid'
    }

    const { error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', orderId)

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    if (bookingStatus === 'cancelled') {
      await supabase
        .from('rental_bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('booking_id', orderId)
        .neq('status', 'returned')
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Midtrans webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
