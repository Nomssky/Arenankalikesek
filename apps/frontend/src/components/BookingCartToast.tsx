'use client'

import { createPortal } from 'react-dom'
import { useEffect } from 'react'

interface BookingCartToastProps {
  notice: { count: number; itemNames: string[] } | null
  onClose: () => void
  onViewCart: () => void
  onCheckout: () => void
}

export default function BookingCartToast({ notice, onClose, onViewCart, onCheckout }: BookingCartToastProps) {
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      onClose()
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [notice, onClose])

  if (!notice || typeof document === 'undefined') return null

  const content = (
    <div
      className="fixed bottom-4 right-4 z-[9999] max-w-xl rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl animate-[toast-slide-in_300ms_cubic-bezier(0.16,1,0.3,1)_both] sm:w-[min(28rem,calc(100%-2rem))]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-950">Berhasil ditambahkan ke Keranjang Booking.</p>
          <p className="mt-1 text-xs text-gray-600">{notice.count} layanan tersimpan. Anda dapat memilih layanan lain atau melanjutkan checkout.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Tutup notifikasi"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">Lanjut Pilih Layanan</button>
        <button type="button" onClick={onViewCart} className="min-h-11 rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">Lihat Keranjang</button>
        <button type="button" onClick={onCheckout} className="min-h-11 rounded-full bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600">Lanjut ke Checkout</button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}