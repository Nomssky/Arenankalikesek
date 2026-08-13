import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'
import { verifyMidtransNotification, mapMidtransStatus, refundTransaction } from '../../../../lib/midtrans'
import { sendBookingPaid } from '../../../../lib/email'

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
      .select('status, payment_status, total_amount')
      .eq('id', orderId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const webhookAmount = Math.round(Number(grossAmount))
    if (!Number.isFinite(webhookAmount) || webhookAmount !== Math.round(Number(existing.total_amount))) {
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    // Booking dibatalkan/kedaluwarsa — jangan pernah mengaktifkannya kembali
    // (trigger sync_booking_resource_status akan merebut slot penginapan/edu-trip
    // yang sudah lepas dan bisa bentrok dengan booking baru). Uang yang sempat
    // masuk di-refund otomatis agar admin tidak perlu manual. Dipanggil juga dari
    // CAS update yang gagal mencocokkan status (race dengan sweep hold-expiry).
    async function cancelledBookingResponse() {
      const cancelledPatch: Record<string, unknown> = {
        transaction_id: transactionId || null,
        payment_method: paymentType || null,
        updated_at: new Date().toISOString(),
      }
      if (transactionStatus === 'capture') {
        // Authorized tapi belum settle — catat dulu; webhook settlement berikutnya
        // yang akan mengeksekusi refund.
        cancelledPatch.payment_status = 'paid'
      } else if (transactionStatus === 'settlement') {
        const { data: cancelledBooking } = await supabase
          .from('bookings')
          .select('payment_status')
          .eq('id', orderId)
          .maybeSingle()
        if (cancelledBooking && cancelledBooking.payment_status !== 'refunded') {
          try {
            await refundTransaction(orderId, webhookAmount, `refund-${orderId}`)
            cancelledPatch.payment_status = 'refunded'
          } catch (refundError) {
            console.error('Auto-refund failed:', refundError)
            cancelledPatch.payment_status = 'paid'
            // Biarkan Midtrans retry webhook sampai refund berhasil; refund_key
            // sama mencegah refund ganda. Bila tetap gagal, admin refund manual.
            return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
          }
        }
      }
      const { error: cancelledError } = await supabase
        .from('bookings')
        .update(cancelledPatch)
        .eq('id', orderId)
        .eq('status', 'cancelled')
        .select('id')
      if (cancelledError) {
        console.error('Supabase update error:', cancelledError)
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
      }
      return NextResponse.json({ status: 'ok' })
    }

    if (existing.status === 'cancelled') {
      return cancelledBookingResponse()
    }

    if (existing.payment_status === 'paid' && transactionStatus !== 'refund') {
      return NextResponse.json({ status: 'already_processed' })
    }
    if (existing.payment_status === 'refunded') {
      return NextResponse.json({ status: 'already_processed' })
    }

    const { bookingStatus, paymentStatus } = mapMidtransStatus(transactionStatus, fraudStatus)

    const updateData: Record<string, unknown> = {
      status: bookingStatus,
      payment_status: paymentStatus,
      payment_method: paymentType || null,
      transaction_id: transactionId || null,
      midtrans_status: transactionStatus,
      payment_last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: updatedRows, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', orderId)
      .eq('status', existing.status)
      .select('id')

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Compare-and-set: status sudah berubah sejak SELECT (biasanya di-cancel
      // expire_stale_booking_holds atau admin) — jangan menimpa status terbaru.
      // Kalau sudah cancelled dan uang masuk: refund otomatis seperti branch di atas.
      const { data: latest } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', orderId)
        .maybeSingle()
      if (latest?.status === 'cancelled') {
        return cancelledBookingResponse()
      }
      return NextResponse.json({ status: 'already_processed' })
    }

    // Email konfirmasi lunas (best-effort, anti-duplikat via flag di DB).
    if (bookingStatus === 'paid') {
      await sendBookingPaid(orderId)
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
