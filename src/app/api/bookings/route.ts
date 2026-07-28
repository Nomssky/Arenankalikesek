import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { createSnapTransaction, isMidtransConfigured } from '@/lib/midtrans'
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

function timeOverlaps(
  newStart: string,
  newEnd: string | undefined,
  existingStart: string | null,
  existingEnd: string | null,
): boolean {
  if (!existingStart) return true
  const ns = newStart
  const ne = newEnd || newStart
  const es = existingStart
  const ee = existingEnd || existingStart
  return ns < ee && ne > es
}

async function checkAvailability(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  items: { id?: string; name: string; quantity?: number; price: number }[],
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
): Promise<string | null> {
  if (!bookingDate || !items.length) return null

  for (const item of items) {
    const itemId = item.id || ''
    if (!itemId) continue

    const { data: conflicts } = await supabase
      .from('rental_bookings')
      .select('id, time_start, time_end')
      .eq('item_id', itemId)
      .eq('booking_date', bookingDate)
      .neq('status', 'cancelled')

    if (conflicts && conflicts.length > 0) {
      if (!timeStart) {
        return `"${item.name}" sudah dibooking pada tanggal tersebut`
      }
      const hasOverlap = conflicts.some(
        (c) => c.time_start && timeOverlaps(timeStart, timeEnd, c.time_start, c.time_end),
      )
      if (hasOverlap) {
        return `"${item.name}" sudah dibooking pada slot tersebut`
      }
    }
  }

  return null
}

async function createRentalBookings(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bookingId: string,
  items: { id?: string; name: string; quantity?: number; price: number }[],
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
) {
  if (!bookingDate || !items.length) return

  const entries: {
    id: string
    booking_id: string
    item_id: string
    item_name: string | null
    quantity: number
    booking_date: string
    time_start: string | null
    time_end: string | null
    total_price: number
    status: string
  }[] = []

  for (const item of items) {
    entries.push({
      id: generateId(),
      booking_id: bookingId,
      item_id: item.id || `item-${Math.random().toString(36).substring(2, 8)}`,
      item_name: item.name || null,
      quantity: item.quantity || 1,
      booking_date: bookingDate,
      time_start: timeStart || null,
      time_end: timeEnd || null,
      total_price: (item.price || 0) * (item.quantity || 1),
      status: 'active',
    })
  }

  await supabase.from('rental_bookings').insert(entries)
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

    const conflictError = await checkAvailability(supabase, items || [], bookingDate, timeStart, timeEnd)
    if (conflictError) {
      return NextResponse.json({ error: conflictError }, { status: 409 })
    }

    const { error } = await supabase.from('bookings').insert(bookingData)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Gagal menyimpan booking' },
        { status: 500 }
      )
    }

    supabase
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'unpaid', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .then()

    createRentalBookings(supabase, bookingId, items || [], bookingDate, timeStart, timeEnd)

    const safeItems = (items || []).map(
      (item: { id?: string; name: string; quantity?: number; price: number }) => ({
        id: item.id || `item-${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price,
      }),
    )

    await sendBookingNotification({
      customerName,
      customerPhone,
      type: bookingType,
      items: safeItems,
      totalAmount: parsedTotal,
      bookingDate,
    })

    if (parsedTotal > 0 && isMidtransConfigured()) {
      try {
        const snap = await createSnapTransaction({
          orderId: bookingId,
          grossAmount: parsedTotal,
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone,
          items: safeItems,
        })

        await supabase
          .from('bookings')
          .update({ payment_url: snap.redirect_url })
          .eq('id', bookingId)

        return NextResponse.json({
          bookingId,
          bookingCode: bookingData.booking_code,
          snapToken: snap.token,
          paymentUrl: snap.redirect_url,
        })
      } catch (paymentError) {
        console.error('Payment error:', paymentError)
        return NextResponse.json({
          bookingId,
          bookingCode: bookingData.booking_code,
          snapToken: null,
          paymentUrl: null,
          info: 'Booking berhasil tapi pembayaran bermasalah, hubungi admin',
        })
      }
    }

    if (parsedTotal > 0) {
      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)

      return NextResponse.json({
        bookingId,
        bookingCode: bookingData.booking_code,
        snapToken: null,
        paymentUrl: null,
        info: 'Payment gateway tidak dikonfigurasi, booking langsung dikonfirmasi',
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

    await supabase
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'unpaid', updated_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

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
