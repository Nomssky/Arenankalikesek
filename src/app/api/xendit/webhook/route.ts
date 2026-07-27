import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { mapXenditStatus } from '@/lib/xendit'

const WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_TOKEN) {
      console.error('XENDIT_WEBHOOK_VERIFICATION_TOKEN not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    const callbackToken = request.headers.get('x-callback-token')
    if (!callbackToken || callbackToken !== WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { external_id, status, payment_method, paid_amount } = body

    if (!external_id) {
      return NextResponse.json({ error: 'external_id required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing } = await supabase
      .from('bookings')
      .select('payment_status')
      .eq('id', external_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (existing.payment_status === 'paid') {
      return NextResponse.json({ status: 'already_processed' })
    }

    const { bookingStatus, paymentStatus } = mapXenditStatus(status)

    let parsedAmount: number | undefined
    if (paid_amount !== undefined && paid_amount !== null) {
      parsedAmount = Number(paid_amount)
      if (isNaN(parsedAmount)) {
        return NextResponse.json({ error: 'Invalid paid_amount' }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_status: paymentStatus,
        payment_method: payment_method || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', external_id)

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Xendit webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
