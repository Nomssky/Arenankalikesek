'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface TourPackage {
  id: string
  name: string
  category: string
  image: string
  price_label: string
}

const featuredServiceIds = [
  'berkuda',
  'keceh-kali',
  'kolam-renang',
  'kereta-sawah',
  'rainbow-slide',
  'taman-kelinci',
]
const featuredCategories = new Set(['aktivitas', 'gratis', 'fishing'])

export default function HomeFeaturedWisata() {
  const [items, setItems] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tour-packages?available=true')
      .then(async (response) => {
        if (!response.ok) throw new Error('Gagal memuat harga wisata')
        return response.json() as Promise<TourPackage[]>
      })
      .then((data) => {
        if (cancelled) return
        const byId = new Map(data.map((item) => [item.id, item]))
        const preferredItems = featuredServiceIds.flatMap((id) => {
          const item = byId.get(id)
          return item ? [item] : []
        })
        const preferredIds = new Set(preferredItems.map((item) => item.id))
        const fallbackItems = data.filter((item) => featuredCategories.has(item.category) && !preferredIds.has(item.id))
        setItems([...preferredItems, ...fallbackItems].slice(0, 6))
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6" aria-label="Memuat harga wisata">
        {featuredServiceIds.map((id) => (
          <div key={id} className="aspect-[3/4.6] min-h-[205px] animate-pulse rounded-b-[1.25rem] rounded-t-[5rem] bg-emerald-950/10 min-[380px]:min-h-[230px] sm:min-h-[285px]" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="rounded-2xl bg-white p-5 text-center text-sm text-gray-600">Harga wisata sedang tidak dapat dimuat. Silakan buka halaman Wisata.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/jadwal?category=${item.category}`}
          className="motion-card group relative aspect-[3/4.6] min-h-[205px] overflow-hidden rounded-b-[1.25rem] rounded-t-[5rem] bg-emerald-950 shadow-[0_16px_32px_-18px_rgba(12,54,27,0.55)] min-[380px]:min-h-[230px] sm:min-h-[285px]"
        >
          <div
            role="img"
            aria-label={item.name}
            className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-[1.03]"
            style={{ backgroundImage: `url(${item.image})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/5" />
          <div className="absolute inset-x-0 bottom-0 px-3 pb-4 text-center text-white">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-orange-300">{item.price_label}</p>
            <h3 className="mt-1 text-sm font-semibold leading-5 sm:text-base">{item.name}</h3>
          </div>
        </Link>
      ))}
    </div>
  )
}
