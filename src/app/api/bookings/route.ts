import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { createXenditInvoice, isXenditConfigured } from '@/lib/xendit'
import { sendBookingNotification } from '@/lib/wa'
import { generateId } from '@/lib/utils'
import { requireAdmin } from '@/lib/admin-guard'
import type { BookingType } from '@/lib/types'

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
      participantCount,
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

    const validTypes: BookingType[] = ['wisata', 'toko', 'parkir', 'sewa']
    const bookingType: BookingType = validTypes.includes(type) ? type : 'wisata'

    const parsedTotal = Math.max(0, Number(totalAmount) || 0)
    if (!isFinite(parsedTotal)) {
      return NextResponse.json(
        { error: 'Total amount tidak valid' },
        { status: 400 }
      )
    }

    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items harus berupa array' },
        { status: 400 }
      )
    }

    const bookingId = generateId()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const bookingNotes = [
      participantCount ? `Jumlah peserta: ${Math.max(1, Number(participantCount) || 1)} orang` : '',
      notes || '',
    ]
      .filter(Boolean)
      .join('\n')

    const bookingData = {
      id: bookingId,
      type: bookingType,
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
      total_amount: parsedTotal,
      status: 'pending',
      payment_status: 'unpaid',
      notes: bookingNotes || null,
      expires_at: expiresAt,
    }

    if (!isSupabaseConfigured()) {
      const now = new Date().toISOString()
      const localBooking = {
        ...bookingData,
        status: 'confirmed',
        payment_status: 'unpaid',
        payment_method: null,
        payment_url: null,
        assigned_pic: null,
        created_at: now,
        updated_at: now,
      }

      return NextResponse.json({
        bookingId,
        bookingCode: bookingData.booking_code,
        paymentUrl: null,
        local: true,
        booking: localBooking,
        info: 'Booking tersimpan pada perangkat untuk mode localhost',
      })
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

    const safeItems: { name: string; quantity: number; price: number }[] = (items || []).map(
      (item: { name: string; quantity?: number; price: number }) => ({
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price,
      })
    )

    if (parsedTotal > 0) {
      if (!isXenditConfigured()) {
        await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', bookingId)

        return NextResponse.json({
          bookingId,
          bookingCode: bookingData.booking_code,
          paymentUrl: null,
          info: 'Payment gateway tidak dikonfigurasi, booking langsung dikonfirmasi',
        })
      }

      try {
        const invoice = await createXenditInvoice({
          externalId: bookingId,
          amount: parsedTotal,
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone,
          items: safeItems,
        })

        await supabase
          .from('bookings')
          .update({ payment_url: invoice.invoice_url })
          .eq('id', bookingId)

        await sendBookingNotification({
          customerName,
          customerPhone,
          type: bookingType,
          items: safeItems,
          totalAmount: parsedTotal,
          bookingDate,
        })

        return NextResponse.json({
          bookingId,
          bookingCode: bookingData.booking_code,
          paymentUrl: invoice.invoice_url,
          invoiceId: invoice.id,
        })
      } catch (paymentError) {
        console.error('Payment error:', paymentError)
        await supabase
          .from('bookings')
          .update({ status: 'confirmed', notes: 'Payment failed, manually confirmed' })
          .eq('id', bookingId)

        return NextResponse.json({
          bookingId,
          bookingCode: bookingData.booking_code,
          paymentUrl: null,
          info: 'Booking berhasil tapi pembayaran bermasalah, hubungi admin',
        })
      }
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
  const auth = await requireAdmin(request)
  if (auth) return auth

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
      return NextResponse.json({ error: 'Gagal memuat data booking' }, { status: 500 })
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
