import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { createMidtransTransaction } from '@/lib/midtrans'
import { sendBookingNotification } from '@/lib/wa'
import { generateId } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type,
      customerName,
      customerPhone,
      customerEmail,
      bookingDate,
      notes,
      items,
      totalAmount,
    } = body

    if (!customerName || !customerPhone || !bookingDate) {
      return NextResponse.json(
        { error: 'Data tidak lengkap' },
        { status: 400 }
      )
    }

    const bookingId = generateId()

    const bookingData = {
      id: bookingId,
      type,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      booking_date: bookingDate,
      items: JSON.stringify(items),
      total_amount: totalAmount,
      status: 'pending',
      notes: notes || null,
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

      const supabaseUpd = getSupabaseAdmin() as any
      await supabaseUpd
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
        paymentUrl: transaction.redirect_url,
        token: transaction.token,
      })
    }

    const supabaseConfirm = getSupabaseAdmin() as any
    await supabaseConfirm
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', bookingId)

    return NextResponse.json({
      bookingId,
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

  try {
    const supabaseGet = getSupabaseAdmin() as any
    let query = supabaseGet.from('bookings').select('*').order('created_at', { ascending: false })

    if (type) {
      query = query.eq('type', type)
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
