'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { formatPrice, formatDate } from '@/lib/utils'

interface BookingRecord {
  id: string
  booking_code?: string | null
  customer_name?: string
  customer_phone?: string
  type?: string
  status?: string
  payment_status?: string
  total_amount?: number | string | null
  items?: unknown
  booking_date?: string
  created_at?: string
}

interface PaymentState {
  bookingId: string
  bookingCode?: string | null
  state: string
  services: { id: string; name: string; quantity: number }[]
  bookingDate?: string
  totalAmount: number
  expiresAt?: string | null
  paymentUrl?: string | null
  snapToken?: string | null
  canResume: boolean
  scheduleConflict?: boolean
}

interface HistoryRow {
  record: BookingRecord
  phone: string
  live?: PaymentState
  state: 'loading' | 'ok' | 'error'
}

const liveLabel: Record<string, { text: string; className: string }> = {
  paid: { text: 'Lunas', className: 'bg-emerald-50 text-emerald-700' },
  confirmed: { text: 'Dikonfirmasi', className: 'bg-blue-50 text-blue-700' },
  pending: { text: 'Menunggu Pembayaran', className: 'bg-amber-50 text-amber-700' },
  expired: { text: 'Kedaluwarsa', className: 'bg-gray-100 text-gray-500' },
  cancelled: { text: 'Dibatalkan', className: 'bg-red-50 text-red-600' },
  failed: { text: 'Gagal', className: 'bg-red-50 text-red-600' },
  refunded: { text: 'Dikembalikan', className: 'bg-gray-100 text-gray-600' },
  conflict: { text: 'Perlu Konfirmasi Admin', className: 'bg-orange-50 text-orange-700' },
}

function loadSnapJs(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.snap !== 'undefined') {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `${process.env.NEXT_PUBLIC_MIDTRANS_API_URL || 'https://app.sandbox.midtrans.com'}/snap/snap.js`
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.body.appendChild(script)
  })
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: {
        onSuccess?: () => void
        onPending?: () => void
        onError?: () => void
        onClose?: () => void
      }) => void
    }
  }
}

function readStoredBookings(): BookingRecord[] {
  const results: BookingRecord[] = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith('invoice_')) continue
      const id = key.slice('invoice_'.length)
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as BookingRecord
        if (parsed && typeof parsed === 'object' && (parsed.id || id)) {
          results.push({ ...parsed, id: parsed.id || id })
        }
      } catch {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // Penyimpanan browser dibatasi — riwayat kosong lebih aman daripada crash.
  }
  return results
}

export default function BookingHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>(() => {
    const stored = readStoredBookings()
    const pendingId = (() => {
      try {
        return sessionStorage.getItem('pending-booking-id')
      } catch {
        return null
      }
    })()
    const merged = stored.map<HistoryRow>((record) => {
      let phone = ''
      try {
        phone = sessionStorage.getItem(`invoice_phone_${record.id}`) || ''
      } catch {
        phone = ''
      }
      return { record, phone, state: 'loading' as const }
    })
    if (pendingId && !merged.some((row) => row.record.id === pendingId)) {
      merged.unshift({
        record: { id: pendingId },
        phone: (() => {
          try {
            return sessionStorage.getItem(`invoice_phone_${pendingId}`) || ''
          } catch {
            return ''
          }
        })(),
        state: 'loading' as const,
      })
    }
    return merged
  })

  const refreshStatus = useCallback(async (row: HistoryRow): Promise<HistoryRow> => {
    if (!row.phone) return { ...row, state: 'error' }
    try {
      const res = await fetch(
        `/api/bookings/${row.record.id}/payment?phone=${encodeURIComponent(row.phone)}`,
      )
      if (!res.ok) return { ...row, state: 'error' }
      const live = (await res.json()) as PaymentState
      return { ...row, live, state: 'ok' }
    } catch {
      return { ...row, state: 'error' }
    }
  }, [])

  useEffect(() => {
    rows.forEach(async (row) => {
      const refreshed = await refreshStatus(row)
      setRows((current) =>
        current.map((item) =>
          item.record.id === refreshed.record.id ? refreshed : item,
        ),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resumePayment = async (row: HistoryRow) => {
    if (!row.live) return
    const data = row.live
    if (data.snapToken) {
      await loadSnapJs()
      if (window.snap) {
        try {
          sessionStorage.setItem('pending-booking-id', data.bookingId)
        } catch {
          // Penyimpanan dibatasi — Snap tetap berjalan.
        }
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            sessionStorage.removeItem('pending-booking-id')
            window.location.assign(`/booking/sukses?id=${data.bookingId}`)
          },
          onPending: () => {
            window.location.reload()
          },
          onError: () => {
            window.location.reload()
          },
          onClose: () => {
            window.location.reload()
          },
        })
        return
      }
    }
    if (data.paymentUrl) {
      try {
        sessionStorage.setItem('pending-booking-id', data.bookingId)
      } catch {
        // Penyimpanan dibatasi — redirect tetap berjalan.
      }
      window.location.assign(data.paymentUrl)
    }
  }

  const summaryLabel = (row: HistoryRow): string => {
    const live = row.live
    if (live) {
      const names = live.services.map((item) => item.name)
      return names.length ? names.join(', ') : 'Booking wisata'
    }
    const stored = row.record
    if (Array.isArray(stored.items) && stored.items.length > 0) {
      return stored.items
        .map((item) => (item && typeof item === 'object' ? String((item as { name?: string }).name || '') : ''))
        .filter(Boolean)
        .join(', ')
    }
    return 'Booking wisata'
  }

  const statusInfo = (row: HistoryRow) => {
    if (row.live) {
      const info = liveLabel[row.live.state] || liveLabel.pending
      if (row.live.state === 'pending' && row.live.scheduleConflict) {
        return liveLabel.conflict
      }
      return info
    }
    if (row.record.status === 'confirmed' && row.record.payment_status === 'paid') return liveLabel.paid
    if (row.record.status === 'confirmed') return liveLabel.confirmed
    return liveLabel.pending
  }

  const bookingTotal = (row: HistoryRow): number => {
    if (row.live) return Number(row.live.totalAmount || 0)
    return Number(row.record.total_amount || 0)
  }

  return (
    <div className="min-h-screen bg-[#f3f0e6] pb-16 pt-24">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Booking</h1>
        <p className="mt-1 text-sm text-gray-500">
          Booking yang dibuat dari perangkat ini. Status diperbarui secara langsung.
        </p>

        <div className="mt-6 space-y-4">
          {rows.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-lg font-medium text-gray-700">Belum ada booking</p>
              <p className="mt-1 text-sm text-gray-500">
                Pilih jadwal lalu lakukan booking untuk melihat riwayatnya di sini.
              </p>
              <Link
                href="/jadwal"
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                Cek Jadwal
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          )}

          {rows.map((row) => {
            const info = statusInfo(row)
            const total = bookingTotal(row)
            const showResume = Boolean(row.live?.canResume)
            const showInvoice = Boolean(row.live?.state === 'paid') || row.record.status === 'confirmed'
            return (
              <div
                key={row.record.id}
                className="rounded-2xl bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-anywhere font-mono text-xs text-gray-400">
                      {row.record.booking_code || row.record.id}
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">{summaryLabel(row)}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {row.record.booking_date ? formatDate(row.record.booking_date) : ''}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${info.className}`}>
                    {row.live?.state === 'pending' ? (
                      <ClockIcon className="h-3.5 w-3.5" />
                    ) : row.live?.state === 'paid' || row.record.status === 'confirmed' ? (
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                    ) : (
                      <XCircleIcon className="h-3.5 w-3.5" />
                    )}
                    {info.text}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-lg font-bold text-emerald-700">{formatPrice(total)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {showResume && (
                      <button
                        onClick={() => resumePayment(row)}
                        className="btn-primary text-sm"
                      >
                        Lanjutkan Pembayaran
                      </button>
                    )}
                    {showInvoice && (
                      <Link
                        href={`/invoice/${row.record.id}?phone=${encodeURIComponent(row.phone)}`}
                        className="btn-outline inline-flex items-center gap-1.5 text-sm"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                        Lihat Invoice
                      </Link>
                    )}
                    <Link
                      href={`/invoice/${row.record.id}`}
                      className="text-sm text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
                    >
                      Detail
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Butuh bantuan? Hubungi kami via WhatsApp 0857-4117-1957.
        </p>
      </div>
    </div>
  )
}
