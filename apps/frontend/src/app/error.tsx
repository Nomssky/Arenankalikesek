'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#f3f0e6]">
      <div className="text-center px-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h2>
        <p className="text-gray-500 mb-6">Maaf, terjadi kesalahan yang tidak terduga.</p>
        <button
          onClick={reset}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
