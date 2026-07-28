import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase-server'
import { generateId } from '@/lib/utils'
import { requireAdmin } from '@/lib/admin-guard'

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
      paymentStatus,
    } = body

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Nama dan nomor telepon harus diisi' }, { status: 400 })
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
      status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
      payment_status: paymentStatus || 'unpaid',
      payment_method: 'offline',
      notes: 'Booking offline (via admin)',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })

    if (error) {
      console.error('Admin booking error:', error)
      return NextResponse.json({ error: 'Gagal menyimpan booking' }, { status: 500 })
    }

    await createRentalBookings(supabase, bookingId, items || [], bookingDate, timeStart, timeEnd)

    return NextResponse.json({ bookingId, success: true })
  } catch (error) {
    console.error('Admin booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
