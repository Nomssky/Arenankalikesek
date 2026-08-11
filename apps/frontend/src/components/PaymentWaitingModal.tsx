'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { CreditCardIcon, DocumentTextIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/lib/utils'

export interface PaymentWaitingData {
  bookingId: string
  bookingCode: string | null
  totalAmount: number
  paymentUrl: string | null
  snapToken: string | null
  serviceName: string | null
  bookingDate: string | null
  timeStart: string | null
  timeEnd: string | null
  expiresAt: string | null
  state: 'pending' | 'expired' | 'cancelled' | 'failed' | 'paid' | 'conflict' | null
}

interface PaymentWaitingModalProps {
  data: PaymentWaitingData | null
  onClose: () => void
  onContinuePayment: (data: PaymentWaitingData) => void
  onLater: () => void
}

export default function PaymentWaitingModal({ data, onClose, onContinuePayment, onLater }: PaymentWaitingModalProps) {
  useEffect(() => {
    if (!data) return
    const root = document.documentElement
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      root.style.overflow = previousRootOverflow
      document.body.style.overflow = previousBodyOverflow
      document.body.style.overscrollBehavior = previousOverscroll
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [data, onClose])

  if (!data) return null

  const isExpired = data.state === 'expired'
  const isCancelled = data.state === 'cancelled'
  const isFailed = data.state === 'failed'
  const isPaid = data.state === 'paid'
  const canResume = data.state === 'pending' && !isExpired && !isCancelled && !isFailed && Boolean(data.paymentUrl)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-waiting-title">
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overscroll-contain overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl">
        <div className="h-1.5 bg-orange-500" />
        <button type="button" onClick={onClose} aria-label="Tutup pemberitahuan" className="absolute right-4 top-5 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="px-5 pb-6 pt-8 text-center sm:px-7">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <ExclamationTriangleIcon className="h-8 w-8" />
          </div>
          <h2 id="payment-waiting-title" className="mt-5 text-2xl font-bold text-emerald-950">Pembayaran Belum Selesai</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">
            Pesanan Anda masih menunggu pembayaran. Selesaikan pembayaran agar jadwal dapat dikonfirmasi.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-4 text-left">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Kode booking</p>
              <p className="mt-1 break-all font-mono text-xs font-bold text-gray-900">{data.bookingCode || data.bookingId}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Total</p>
              <p className="mt-1 text-base font-bold text-emerald-700">{formatPrice(data.totalAmount)}</p>
            </div>
            {data.serviceName && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Layanan</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{data.serviceName}</p>
              </div>
            )}
            {data.bookingDate && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Tanggal booking</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {data.bookingDate}
                  {data.timeStart ? ` - ${data.timeStart}${data.timeEnd ? ` - ${data.timeEnd}` : ''}` : ''}
                </p>
              </div>
            )}
            {data.expiresAt && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Batas waktu pembayaran</p>
                <p className="mt-1 text-sm font-medium text-orange-600">{new Date(data.expiresAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            )}
          </div>

          {isExpired && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">
              Waktu pembayaran telah habis. Silakan buat pemesanan baru.
            </div>
          )}

          {isCancelled && (
            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-600">
              Pembayaran telah dibatalkan. Silakan buat pemesanan baru.
            </div>
          )}

          {isFailed && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">
              Pembayaran gagal. Silakan coba kembali.
            </div>
          )}

          {isPaid && (
            <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-700">
              Pembayaran berhasil. Silakan lihat invoice untuk detail.
            </div>
          )}

          {!isExpired && !isCancelled && !isFailed && !isPaid && (
            <div className="mt-5 space-y-2.5">
              {canResume && (
                <button
                  type="button"
                  onClick={() => onContinuePayment(data)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  <CreditCardIcon className="h-5 w-5" />
                  Lanjutkan Pembayaran
                </button>
              )}
              <button
                type="button"
                onClick={onLater}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Nanti Saja
              </button>
              {data.paymentUrl && (
                <a href={data.paymentUrl} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  Buka Halaman Pembayaran
                </a>
              )}
              <Link href={`/invoice/${data.bookingId}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                <DocumentTextIcon className="h-4 w-4" />
                Lihat Invoice
              </Link>
            </div>
          )}

          <p className="mt-4 text-xs leading-5 text-gray-500">Booking yang belum dibayar tidak ditampilkan sebagai jadwal aktif.</p>
        </div>
      </div>
    </div>
  )
}
