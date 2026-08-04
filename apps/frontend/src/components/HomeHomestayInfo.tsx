'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatPrice } from '@/lib/utils'

interface TourPackage {
  price: number
  capacity: string | null
}

export default function HomeHomestayInfo() {
  const [homestays, setHomestays] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tour-packages?category=homestay&available=true')
      .then(async (response) => {
        if (!response.ok) throw new Error('Gagal memuat harga homestay')
        return response.json() as Promise<TourPackage[]>
      })
      .then((data) => {
        if (!cancelled) setHomestays(data)
      })
      .catch(() => {
        if (!cancelled) setHomestays([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const capacityLabel = useMemo(() => {
    const values = homestays.flatMap((item) => item.capacity?.match(/\d+/g)?.map(Number) || [])
    if (values.length === 0) return 'Lihat pilihan homestay'
    return `${Math.min(...values)}–${Math.max(...values)} orang`
  }, [homestays])
  const minimumPrice = homestays.length > 0
    ? Math.min(...homestays.map((item) => item.price))
    : null

  return (
    <ul className="mt-6 space-y-4 text-sm text-gray-600" aria-busy={loading}>
      <li className="flex flex-col gap-1 border-b border-gray-100 pb-3 min-[380px]:flex-row min-[380px]:justify-between">
        <span>Kapasitas</span>
        <strong className="text-gray-900">{loading ? 'Memuat…' : capacityLabel}</strong>
      </li>
      <li className="flex flex-col gap-1 border-b border-gray-100 pb-3 min-[380px]:flex-row min-[380px]:justify-between">
        <span>Check-in</span>
        <strong className="text-gray-900">14.00 WIB</strong>
      </li>
      <li className="flex flex-col gap-1 border-b border-gray-100 pb-3 min-[380px]:flex-row min-[380px]:justify-between">
        <span>Harga</span>
        <strong className="text-gray-900">
          {loading ? 'Memuat…' : minimumPrice === null ? 'Lihat pilihan homestay' : `Mulai ${formatPrice(minimumPrice)}`}
        </strong>
      </li>
    </ul>
  )
}
