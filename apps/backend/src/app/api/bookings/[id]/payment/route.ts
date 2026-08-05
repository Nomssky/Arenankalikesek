import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../../../lib/supabase-server'
import { digits, timeToMinutes } from '../../../../../lib/utils'
import { sendBookingPaid } from '../../../../../lib/email'
import {
  getTransactionStatus,
  isMidtransConfigured,
  mapMidtransStatus,
  snapTokenFromRedirectUrl,
} from '../../../../../lib/midtrans'

type PaymentState = 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed' | 'refunded' | 'conflict'

function overlaps(
  start: string | null,
  end: string | null,
  otherStart: string | null,
  otherEnd: string | null,
) {
  if (!start || !otherStart) return true
  const startMinute = timeToMinutes(start)
  const endMinute = timeToMinutes(end) ?? (startMinute === null ? null : startMinute + 60)
  const otherStartMinute = timeToMinutes(otherStart)
  const otherEndMinute = timeToMinutes(otherEnd) ?? (otherStartMinute === null ? null : otherStartMinute + 60)
  if (startMinute === null || endMinute === null || otherStartMinute === null || otherEndMinute === null) return true
  return startMinute < otherEndMinute && endMinute > otherStartMinute
}

async function hasScheduleConflict(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bookingId: string,
) {
  const [rentals, stays, eduTrips] = await Promise.all([
    supabase
      .from('rental_bookings')
      .select('item_id, booking_date, time_start, time_end')
      .eq('booking_id', bookingId)
      .eq('status', 'hold'),
    supabase
      .from('accommodation_bookings')
      .select('item_id, check_in_date, check_out_date')
      .eq('booking_id', bookingId)
      .eq('status', 'hold'),
    supabase
      .from('edu_trip_reservations')
      .select('booking_date')
      .eq('booking_id', bookingId)
      .eq('status', 'hold'),
  ])

  if (rentals.error || stays.error || eduTrips.error) {
    throw new Error('Ketersediaan jadwal gagal diperiksa')
  }

  const rentalIds = (rentals.data || []).map((row) => row.item_id)
  const rentalDates = (rentals.data || []).map((row) => String(row.booking_date))
  const stayIds = (stays.data || []).map((row) => row.item_id)
  const eduDates = (eduTrips.data || []).map((row) => String(row.booking_date))
  const empty = { data: [] as never[], error: null }

  // Satu kueri per tabel untuk semua item booking (sebelumnya N+1 per item).
  const [liveRentals, liveStays, blocks, liveEdu, quotaSetting] = await Promise.all([
    rentalIds.length
      ? supabase
          .from('rental_bookings')
          .select('item_id, booking_date, time_start, time_end')
          .in('item_id', rentalIds)
          .in('booking_date', rentalDates)
          .eq('status', 'active')
          .neq('booking_id', bookingId)
      : empty,
    stayIds.length
      ? supabase
          .from('accommodation_bookings')
          .select('item_id, check_in_date, check_out_date')
          .in('item_id', stayIds)
          .eq('status', 'active')
          .neq('booking_id', bookingId)
      : empty,
    stayIds.length
      ? supabase
          .from('booking_date_blocks')
          .select('item_id, start_date, end_date')
          .in('item_id', stayIds)
          .eq('active', true)
      : empty,
    // Kuota Edu Trip ikut menghitung hold+active, konsisten dengan reserve_booking (020).
    eduDates.length
      ? supabase
          .from('edu_trip_reservations')
          .select('booking_date')
          .in('booking_date', eduDates)
          .in('status', ['hold', 'active'])
          .neq('booking_id', bookingId)
      : empty,
    supabase
      .from('booking_settings')
      .select('value_numeric')
      .eq('key', 'edu_trip.daily_quota')
      .maybeSingle(),
  ])

  if (
    liveRentals.error || liveStays.error || blocks.error ||
    liveEdu.error || quotaSetting.error
  ) {
    throw new Error('Ketersediaan jadwal gagal diperiksa')
  }

  if ((rentals.data || []).some((rental) => (liveRentals.data || []).some((row) =>
    row.item_id === rental.item_id &&
    row.booking_date === rental.booking_date &&
    overlaps(rental.time_start, rental.time_end, row.time_start, row.time_end)
  ))) return true

  if ((stays.data || []).some((stay) =>
    (liveStays.data || []).some((row) =>
      row.item_id === stay.item_id &&
      stay.check_in_date < row.check_out_date && stay.check_out_date > row.check_in_date
    ) ||
    (blocks.data || []).some((row) =>
      row.item_id === stay.item_id &&
      stay.check_in_date < row.end_date && stay.check_out_date > row.start_date
    )
  )) return true

  const quota = Number(quotaSetting.data?.value_numeric ?? 2)
  if ((eduTrips.data || []).some((eduTrip) =>
    (liveEdu.data || []).filter((row) => row.booking_date === eduTrip.booking_date).length >= quota
  )) return true

  return false
}

function paymentState(booking: Record<string, unknown>): PaymentState {
  const paymentStatus = String(booking.payment_status || '')
  const bookingStatus = String(booking.status || '')
  const midtransStatus = String(booking.midtrans_status || '')
  if (paymentStatus === 'refunded') return 'refunded'
  if (paymentStatus === 'paid' && ['paid', 'confirmed'].includes(bookingStatus)) return 'paid'
  if (midtransStatus === 'expire') return 'expired'
  if (midtransStatus === 'deny' || midtransStatus === 'failure') return 'failed'
  if (midtransStatus === 'cancel' || bookingStatus === 'cancelled') return 'cancelled'
  return 'pending'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const phone = digits(request.nextUrl.searchParams.get('phone'))
  if (!phone) return NextResponse.json({ error: 'Nomor WhatsApp wajib diisi' }, { status: 400 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Pembayaran tidak tersedia' }, { status: 503 })

  try {
    const supabase = getSupabaseAdmin()
    await supabase.rpc('expire_stale_booking_holds')

    const selectFields = 'id, booking_code, customer_phone, status, payment_status, payment_url, midtrans_status, total_amount, items, booking_date, time_start, time_end, check_in_date, check_out_date, expires_at, notes'
    const { data: bookingData, error } = await supabase
      .from('bookings')
      .select(selectFields)
      .eq('id', id)
      .single()
    let booking = bookingData

    if (error || !booking) return NextResponse.json({ error: 'Booking tidak ditemukan' }, { status: 404 })
    if (phone !== digits(booking.customer_phone)) {
      return NextResponse.json({ error: 'Nomor WhatsApp tidak cocok' }, { status: 403 })
    }

    if (
      booking.status === 'pending' &&
      booking.payment_status === 'unpaid' &&
      booking.payment_url &&
      isMidtransConfigured()
    ) {
      try {
        const transaction = await getTransactionStatus(id)
        const amountMatches = Math.round(Number(transaction.gross_amount)) === Math.round(Number(booking.total_amount))
        if (transaction.order_id === id && amountMatches) {
          const mapped = mapMidtransStatus(transaction.transaction_status, transaction.fraud_status)
          await supabase
            .from('bookings')
            .update({
              status: mapped.bookingStatus,
              payment_status: mapped.paymentStatus,
              payment_method: transaction.payment_type || null,
              transaction_id: transaction.transaction_id || null,
              midtrans_status: transaction.transaction_status,
              payment_last_checked_at: new Date().toISOString(),
            })
            .eq('id', id)

          // Fallback email lunas bila webhook belum sempat memproses (anti-duplikat).
          if (mapped.bookingStatus === 'paid') {
            await sendBookingPaid(id)
          }

          const refreshed = await supabase.from('bookings').select(selectFields).eq('id', id).single()
          if (refreshed.data) booking = refreshed.data
        }
      } catch (statusError) {
        console.error('Midtrans status refresh error:', statusError)
      }
    }

    let state = paymentState(booking)
    const scheduleConflict = state === 'pending' ? await hasScheduleConflict(supabase, id) : false
    if (scheduleConflict) state = 'conflict'
    const expiresAt = booking.expires_at ? String(booking.expires_at) : null
    const notExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now()
    const paymentUrl = booking.payment_url ? String(booking.payment_url) : null
    const canResume = state === 'pending' && notExpired && Boolean(paymentUrl)
    const items = Array.isArray(booking.items) ? booking.items : []

    return NextResponse.json({
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      state,
      services: items.map((item) => ({
        id: String(item?.id || ''),
        name: String(item?.name || 'Layanan booking'),
        quantity: Number(item?.quantity || 1),
      })),
      bookingDate: booking.booking_date,
      timeStart: booking.time_start,
      timeEnd: booking.time_end,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      totalAmount: Number(booking.total_amount || 0),
      expiresAt,
      paymentUrl: canResume ? paymentUrl : null,
      snapToken: canResume ? snapTokenFromRedirectUrl(paymentUrl) : null,
      canResume,
      scheduleConflict,
    })
  } catch (routeError) {
    console.error('Payment status error:', routeError)
    return NextResponse.json({ error: 'Gagal memeriksa status pembayaran' }, { status: 500 })
  }
}
