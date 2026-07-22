'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuksesContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('id')

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Booking Berhasil!
        </h1>
        <p className="text-gray-600 mb-2">
          Terima kasih, booking Anda telah diterima.
        </p>
        {bookingId && (
          <p className="text-sm text-gray-500 mb-2">
            ID Booking: <span className="font-mono font-bold">{bookingId}</span>
          </p>
        )}
        <p className="text-sm text-gray-500 mb-8">
          Kami akan mengirimkan konfirmasi via WhatsApp.
          Simpan invoice sebagai bukti booking.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {bookingId && (
            <Link href={`/invoice/${bookingId}`} className="btn-primary">
              🧾 Lihat Invoice
            </Link>
          )}
          <a
            href="https://wa.me/6285741171957"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            Hubungi via WA
          </a>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mt-2 sm:mt-0 sm:self-center">
            Kembali ke Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function BookingSuksesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    }>
      <SuksesContent />
    </Suspense>
  )
}
