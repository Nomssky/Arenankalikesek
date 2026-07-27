'use client'

import { useEffect } from 'react'

export default function AdminError({
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
    <div className="flex items-center justify-center py-20">
      <div className="text-center px-4">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h2>
        <p className="text-gray-500 mb-4">Gagal memuat halaman admin.</p>
        <button
          onClick={reset}
          className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors text-sm"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
