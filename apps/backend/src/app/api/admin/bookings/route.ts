import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../lib/supabase-server'
import { generateId } from '../../../../lib/utils'
import { requireAdmin } from '../../../../lib/admin-guard'
import { loadResolvedTourCatalog } from '../../../../lib/catalog'
import { EDU_TRIP_MIN_PARTICIPANTS, isEduTripItem } from '@repo/shared-utils'

function generateBookingCode(): string {
  const now = new Date()
  const yymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BKK-${yymm}-${rand}`
}

// p_rentals untuk reserve_booking — satu tanggal layanan untuk semua item,
// sama seperti perilaku lama createRentalBookings. Slot dibuat 'hold' oleh RPC;
// activation/konfirmasi diatur via update di bawah (trigger sync).
function rentalEntries(
  items: { id?: string; name: string; quantity?: number; price: number }[],
  bookingId: string,
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
) {
  if (!bookingDate || !items.length) return []
  const startAt = timeStart ? `${bookingDate}T${timeStart}:00+07:00` : `${bookingDate}T00:00:00+07:00`
  const endAt = timeEnd ? `${bookingDate}T${timeEnd}:00+07:00` : `${bookingDate}T23:59:00+07:00`
  return items.map((item) => ({
    id: generateId(),
    item_id: item.id || `item-${Math.random().toString(36).substring(2, 8)}`,
    item_name: item.name || null,
    quantity: item.quantity || 1,
    booking_date: bookingDate,
    time_start: timeStart || null,
    time_end: timeEnd || null,
    start_at: startAt,
    end_at: endAt,
    total_price: (item.price || 0) * (item.quantity || 1),
  }))
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
      participantCount,
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

    // Deteksi item Edu Trip: selain id/kategori item, cocokkan nama baris form
    // admin (itemsText) dengan katalog — form admin mengirim nama sebagai id.
    const { data: tourCatalog } = await loadResolvedTourCatalog()
    const adminItems: { id?: string; name: string; quantity?: number; price: number }[] = items || []
    const hasEduTrip = adminItems.some(
      (item) => isEduTripItem(item) || (tourCatalog || []).some(
        (entry) => (entry.name === item.name || entry.id === item.id) && isEduTripItem(entry),
      ),
    )
    const peserta = Math.max(1, Number(participantCount) || 1)
    if (hasEduTrip && peserta < EDU_TRIP_MIN_PARTICIPANTS) {
      return NextResponse.json(
        { error: `Paket Edu Trip membutuhkan minimal ${EDU_TRIP_MIN_PARTICIPANTS} peserta` },
        { status: 400 },
      )
    }

    const bookingId = generateId()
    const supabase = getSupabaseAdmin()

    // reserve_booking (020/031): satu transaksi untuk booking + resource —
    // tidak meninggalkan booking yatim bila insert resource gagal, dan ikut
    // cek kuota Edu Trip + lock slot hold/active + overlap rental.
    const { error: reservationError } = await supabase.rpc('reserve_booking', {
      p_booking: {
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
        notes: ['Booking offline (via admin)', peserta > 1 || hasEduTrip ? `Jumlah peserta: ${peserta} orang` : '']
          .filter(Boolean)
          .join('\n'),
        expires_at: null,
      },
      p_rentals: rentalEntries(items || [], bookingId, bookingDate || undefined, timeStart, timeEnd),
      p_is_edu_trip: (items || []).some(isEduTripItem),
    })
    if (reservationError) {
      console.error('Admin reserve booking error:', reservationError)
      const message = String(reservationError?.message || '')
      if (/sudah dibooking|sudah penuh/i.test(message)) {
        return NextResponse.json({ error: 'Tanggal atau jadwal yang dipilih sudah dibooking' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Gagal menyimpan booking' }, { status: 500 })
    }

    // payment_method tidak ada di kolom INSERT reserve_booking → di-set lewat
    // update. Untuk booking lunas, status/payment_status ikut di-SET (nilai sama)
    // agar trigger sync_booking_resource_status berjalan dan slot langsung aktif.
    if (validPaymentStatus === 'paid') {
      const { error: activateError } = await supabase
        .from('bookings')
        .update({ payment_method: 'offline', status: 'confirmed', payment_status: 'paid' })
        .eq('id', bookingId)
      if (activateError) console.error('Admin booking activate error:', activateError)
    } else {
      await supabase.from('bookings').update({ payment_method: 'offline' }).eq('id', bookingId)
    }

    return NextResponse.json({ bookingId, success: true })
  } catch (error) {
    console.error('Admin booking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}