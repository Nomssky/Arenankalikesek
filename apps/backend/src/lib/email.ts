import { formatRupiah } from '@repo/shared-utils'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase-server'

// Notifikasi email via Resend (gratis 3.000 email/bulan). Tanpa dependency
// tambahan — pakai fetch bawaan. Berjalan best-effort: kegagalan tidak pernah
// melempar ke pemanggil agar alur booking/pembayaran tetap aman.

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@arenankalikesek.com'

function isValidEmail(value: string | null | undefined): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isEmailConfigured(): boolean {
  return RESEND_API_KEY.length > 0 && !RESEND_API_KEY.includes('your_resend')
}

// Toggle aktif/non-aktif dari booking_settings (admin). Hanya membaca DB jika
// RESEND_API_KEY terpasang agar tidak menambah roundtrip saat email nonaktif.
export async function isEmailNotificationsActive(): Promise<boolean> {
  if (!isEmailConfigured() || !isSupabaseConfigured()) return false
  try {
    const { data } = await getSupabaseAdmin()
      .from('booking_settings')
      .select('value_numeric')
      .eq('key', 'email_notification.enabled')
      .maybeSingle()
    return Number(data?.value_numeric) === 1
  } catch {
    return false
  }
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!isEmailConfigured() || !isValidEmail(opts.to)) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    })
    if (!res.ok) {
      console.error('Email send error:', await res.text().catch(() => 'unknown'))
      return false
    }
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

interface BookingEmailRow {
  id: string
  booking_code: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  total_amount: number
}

function invoiceUrl(booking: BookingEmailRow): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  return `${site}/invoice/${booking.id}?phone=${encodeURIComponent(booking.customer_phone || '')}`
}

function baseHtml(title: string, paragraphs: string[], url: string, urlLabel: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px;">${p}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;">
    <p style="font-size:18px;font-weight:bold;color:#065f46;margin:0 0 16px;">${escapeHtml(title)}</p>
    ${body}
    <p style="margin:0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 18px;">${escapeHtml(urlLabel)}</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Salam, — Arenan Kalikesek</p>
  </div></body></html>`
}

export async function sendBookingCreatedEmail(booking: BookingEmailRow): Promise<boolean> {
  const totals = `${formatRupiah(booking.total_amount)}`
  return sendEmail({
    to: booking.customer_email || '',
    subject: `Booking Diterima — ${booking.booking_code || ''}`,
    html: baseHtml(
      'Terima kasih! Booking Anda diterima.',
      [
        `Halo ${escapeHtml(booking.customer_name || '')}, booking dengan kode <b>${escapeHtml(booking.booking_code || '')}</b> sudah kami terima.`,
        `Total tagihan: <b>${totals}</b>. Segera selesaikan pembayaran agar jadwal Anda terkunci.`,
        'Link invoice di bawah untuk melihat detail dan melanjutkan pembayaran.',
      ],
      invoiceUrl(booking),
      'Lihat Invoice & Bayar',
    ),
  })
}

export async function sendBookingPaidEmail(booking: BookingEmailRow): Promise<boolean> {
  const totals = `${formatRupiah(booking.total_amount)}`
  return sendEmail({
    to: booking.customer_email || '',
    subject: `Pembayaran Lunas — ${booking.booking_code || ''}`,
    html: baseHtml(
      'Pembayaran Anda telah kami terima.',
      [
        `Halo ${escapeHtml(booking.customer_name || '')}, pembayaran untuk booking <b>${escapeHtml(booking.booking_code || '')}</b> sebesar <b>${totals}</b> sudah lunas.`,
        'Jadwal Anda kini sudah terkunci. Simpan link invoice ini untuk keperluan konfirmasi di lokasi.',
      ],
      invoiceUrl(booking),
      'Lihat Invoice',
    ),
  })
}

// Kirim email konfirmasi booking dibuat (best-effort). Anti-duplikat via flag.
export async function sendBookingCreated(bookingId: string): Promise<void> {
  if (!(await isEmailNotificationsActive())) return
  try {
    const supabase = getSupabaseAdmin()
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_code, customer_name, customer_email, customer_phone, total_amount, email_sent_created_at')
      .eq('id', bookingId)
      .single()
    if (!booking || !booking.customer_email || booking.email_sent_created_at) return
    if (await sendBookingCreatedEmail(booking as BookingEmailRow)) {
      await supabase.from('bookings').update({ email_sent_created_at: new Date().toISOString() }).eq('id', bookingId)
    }
  } catch (error) {
    console.error('Booking email error:', error)
  }
}

// Kirim email pembayaran lunas (best-effort). Anti-duplikat via flag.
export async function sendBookingPaid(bookingId: string): Promise<void> {
  if (!(await isEmailNotificationsActive())) return
  try {
    const supabase = getSupabaseAdmin()
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_code, customer_name, customer_email, customer_phone, total_amount, email_sent_paid_at')
      .eq('id', bookingId)
      .single()
    if (!booking || !booking.customer_email || booking.email_sent_paid_at) return
    if (await sendBookingPaidEmail(booking as BookingEmailRow)) {
      await supabase.from('bookings').update({ email_sent_paid_at: new Date().toISOString() }).eq('id', bookingId)
    }
  } catch (error) {
    console.error('Paid email error:', error)
  }
}