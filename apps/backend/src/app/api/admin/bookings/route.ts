import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'
import { generateId } from '../../../../lib/utils'
import { requireAdmin } from '../../../../lib/admin-guard'

function generateBookingCode(): string {
  const now = new Date()
  const yymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BKK-${yymm}-${rand}`
}

async function createRentalBookings(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bookingId: string,
  items: { id?: string; name: string; quantity?: number; price: number }[],
  resourceStatus: 'hold' | 'active',
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
): Promise<{ error: unknown } | null> {
  if (!bookingDate || !items.length) return null

  const startAt = timeStart ? `${bookingDate}T${timeStart}:00+07:00` : `${bookingDate}T00:00:00+07:00`
  const endAt = timeEnd ? `${bookingDate}T${timeEnd}:00+07:00` : `${bookingDate}T23:59:00+07:00`

  const entries: {
    id: string
    booking_id: string
    item_id: string
    item_name: string | null
    quantity: number
    booking_date: string
    time_start: string | null
    time_end: string | null
    start_at: string | null
    end_at: string | null
    total_price: number
    status: string
    updated_at: string
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
      start_at: startAt,
      end_at: endAt,
      total_price: (item.price || 0) * (item.quantity || 1),
      status: resourceStatus,
      updated_at: new Date().toISOString(),
    })
  }

  const { error } = await supabase.from('rental_bookings').insert(entries)
  if (error) {
    console.error('Admin rental insert error:', error)
    return { error }
  }
  return null
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Not available' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      type,
      bookingDate,
      timeStart,
      timeEnd,
      items,
      totalAmount,
    } = body

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Nama dan nomor telepon harus diisi' }, { status: 400 })
    }
    const validPaymentStatus = ['unpaid', 'paid', 'refunded'].includes(String(body.paymentStatus || 'unpaid'))
      ? String(body.paymentStatus || 'unpaid')
      : null
    if (validPaymentStatus === null) {
      return NextResponse.json({ error: 'Status pembayaran tidak valid' }, { status: 400 })
    }

    const bookingId = generateId()
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.from('bookings').insert({
      id: bookingId,
      type: type || 'wisata',
      booking_code: generateBookingCode(),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      booking_date: bookingDate || null,
      time_start: timeStart || null,
      time_end: timeEnd || null,
      items: items || [],
      total_amount: Math.max(0, Number(totalAmount) || 0),
      status: validPaymentStatus === 'paid' ? 'confirmed' : 'pending',
      payment_status: validPaymentStatus,
      payment_method: 'offline',
      notes: 'Booking offline (via admin)',
      expires_at: null,
    })

    if (error) {
      console.error('Admin booking error:', error)
      return NextResponse.json({ error: 'Gagal menyimpan booking' }, { status: 500 })
    }

    const rentalResult = await createRentalBookings(
      supabase,
      bookingId,
      items || [],
      validPaymentStatus === 'paid' ? 'active' : 'hold',
      bookingDate,
      timeStart,
      timeEnd,
    )
    if (rentalResult) {
      await supabase.from('bookings').delete().eq('id', bookingId)
      return NextResponse.json(
        { error: 'Tanggal atau jadwal yang dipilih sudah dibooking' },
        { status: 409 },
      )
    }

    return NextResponse.json({ bookingId, success: true })
  } catch (error) {
    console.error('Admin booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
