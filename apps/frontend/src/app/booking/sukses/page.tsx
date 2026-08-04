'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

function SuksesContent() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('id') || searchParams.get('order_id')

  return (
    <div className="flex min-h-[70vh] items-center justify-center pt-24">
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">Booking Berhasil!</h1>
        <p className="mb-2 text-gray-600">Terima kasih, booking Anda telah diterima.</p>
        {bookingId && (
          <p className="mb-2 text-sm text-gray-500">
            ID Booking: <span className="break-anywhere font-mono font-bold">{bookingId}</span>
          </p>
        )}
        <p className="mb-8 text-sm text-gray-500">
          Kami akan mengirimkan konfirmasi via WhatsApp. Simpan invoice sebagai bukti booking.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {bookingId && (
            <Link href={`/invoice/${bookingId}`} className="btn-primary">
              <DocumentTextIcon className="h-4 w-4" />
              Lihat Invoice
            </Link>
          )}
          <a href="https://wa.me/6285741171957" target="_blank" rel="noopener noreferrer" className="btn-outline">
            Hubungi via WA
          </a>
          <Link href="/" className="mt-2 text-sm text-gray-500 hover:text-gray-700 sm:mt-0 sm:self-center">Kembali ke Home</Link>
        </div>
      </div>
    </div>
  )
}

export default function BookingSuksesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    }>
      <SuksesContent />
    </Suspense>
  )
}
