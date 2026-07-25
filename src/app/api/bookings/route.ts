import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { createMidtransTransaction } from '@/lib/midtrans'
import { sendBookingNotification } from '@/lib/wa'
import { generateId } from '@/lib/utils'

function generateBookingCode(): string {
  const now = new Date()
  const yymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BKK-${yymm}-${rand}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      eventName,
      bookingDate,
      timeStart,
      timeEnd,
      notes,
      items,
      totalAmount,
    } = body

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Nama dan nomor telepon harus diisi' },
        { status: 400 }
      )
    }

    const bookingId = generateId()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const bookingData = {
      id: bookingId,
      type,
      booking_code: generateBookingCode(),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      event_name: eventName || null,
      booking_date: bookingDate || null,
      time_start: timeStart || null,
      time_end: timeEnd || null,
      items: items || [],
      total_amount: totalAmount || 0,
      status: 'pending',
      payment_status: 'unpaid',
      notes: notes || null,
      expires_at: expiresAt,
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('bookings').insert(bookingData)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Gagal menyimpan booking' },
        { status: 500 }
      )
    }

    if (totalAmount > 0) {
      const transaction = await createMidtransTransaction({
        transactionId: bookingId,
        grossAmount: totalAmount,
        customerName,
        customerEmail: customerEmail || `${customerPhone}@email.com`,
        customerPhone,
        items: items.map((item: { id: string; name: string; price: number; quantity: number }) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      })

      await supabase
        .from('bookings')
        .update({ payment_url: transaction.redirect_url })
        .eq('id', bookingId)

      await sendBookingNotification({
        customerName,
        customerPhone,
        type,
        items: items.map((item: { name: string; quantity: number; price: number }) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount,
        bookingDate,
      })

      return NextResponse.json({
        bookingId,
        bookingCode: bookingData.booking_code,
        paymentUrl: transaction.redirect_url,
        token: transaction.token,
      })
    }

    await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', bookingId)

    return NextResponse.json({
      bookingId,
      bookingCode: bookingData.booking_code,
      paymentUrl: null,
    })
  } catch (error) {
    console.error('Booking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const paymentStatus = searchParams.get('payment_status')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  try {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('type', type)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus)
    }
    if (startDate) {
      query = query.gte('booking_date', startDate)
    }
    if (endDate) {
      query = query.lte('booking_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
