'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CategoryVisualHeader from '@/components/CategoryVisualHeader'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { getServiceCategory, serviceCategories } from '@/lib/service-categories'
import { formatPrice } from '@/lib/utils'

const wisataCategoryIds = new Set([
  'semua',
  'tiket',
  'aktivitas',
  'paket-edukasi',
  'gratis',
  'sewa-tempat',
  'homestay',
  'camping',
  'fishing',
])

const wisataCategories = serviceCategories.filter((category) => wisataCategoryIds.has(category.id))

interface TourPackage {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  capacity: string | null
  note: string | null
  image: string
  available: boolean
  sort_order: number
}

interface VisualCardProps {
  categoryId: string
  children: React.ReactNode
  className?: string
}

function VisualCard({ categoryId, children, className = '' }: VisualCardProps) {
  const category = getServiceCategory(categoryId)

  return (
    <article
      className={`card bg-cover bg-center p-5 ${className}`}
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.89), rgba(255,255,255,0.95)), url(${category.image})`,
        backgroundPosition: category.position || 'center',
      }}
    >
      {children}
    </article>
  )
}

function formatItemPrice(item: TourPackage): string {
  if (item.price === 0) return 'Gratis'
  if (item.max_price) return `${formatPrice(item.price)} - ${formatPrice(item.max_price)}`
  return formatPrice(item.price)
}

const sectionCategories: Record<string, string[]> = {
  tiket: ['tiket'],
  aktivitas: ['aktivitas'],
  'paket-edukasi': ['paket-edukasi', 'gratis'],
  'sewa-tempat': ['sewa-tempat', 'camping', 'homestay', 'fishing'],
}

function isSectionVisible(activeCategory: string, sectionKey: string): boolean {
  if (activeCategory === 'semua') return true
  const cats = sectionCategories[sectionKey]
  if (!cats) return false
  return cats.includes(activeCategory) || sectionKey === activeCategory
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-red-50 p-6 text-center">
      <p className="text-lg font-medium text-red-700">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        Coba Lagi
      </button>
    </div>
  )
}

export default function WisataPage() {
  const [activeCategory, setActiveCategory] = useState('semua')
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeCategoryInfo = getServiceCategory(activeCategory)

  async function fetchPackages() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tour-packages?available=true')
      if (res.ok) {
        setPackages(await res.json())
      } else {
        setError('Gagal memuat paket wisata')
      }
    } catch {
      setError('Gagal memuat paket wisata')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPackages()
  }, [])

  const packagesBySection: Record<string, TourPackage[]> = {
    tiket: [],
    aktivitas: [],
    'paket-edukasi': [],
    'sewa-tempat': [],
  }

  for (const pkg of packages) {
    if (!pkg.available) continue
    for (const [sectionKey, cats] of Object.entries(sectionCategories)) {
      if (cats.includes(pkg.category)) {
        packagesBySection[sectionKey].push(pkg)
        break
      }
    }
  }

  const ticketPackages = packagesBySection.tiket
  const activityPackages = packagesBySection.aktivitas
  const educationPackages = packagesBySection['paket-edukasi']
  const rentalPackages = packagesBySection['sewa-tempat']

  const homestayPackages = rentalPackages.filter((p) => p.category === 'homestay')

  return (
    <>
      <Hero
        title="Wisata Kalikesek"
        subtitle="Temukan berbagai pilihan aktivitas wisata seru"
        image="/images/wisata-keceh-air.jpg"
        height="sm"
      />

      <Section className="relative overflow-hidden bg-[#fbfaf5]">
        <CategoryVisualHeader category={activeCategoryInfo} />
        <nav aria-label="Kategori wisata" className="flex flex-wrap gap-2">
          {wisataCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              aria-pressed={activeCategory === category.id}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </nav>
      </Section>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Section>
          <ErrorBanner message={error} onRetry={fetchPackages} />
        </Section>
      ) : packages.length === 0 ? (
        <Section>
          <div className="py-16 text-center">
            <p className="text-lg font-medium text-gray-500">Tidak ada paket wisata tersedia</p>
            <button
              onClick={fetchPackages}
              className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Muat Ulang
            </button>
          </div>
        </Section>
      ) : (
        <>
          {isSectionVisible(activeCategory, 'tiket') && ticketPackages.length > 0 && (
            <Section title="Tiket & Wahana" subtitle="Tiket masuk dan wahana permainan" className="nature-pattern">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ticketPackages.map((item) => (
                  <VisualCard key={item.id} categoryId="tiket">
                    <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                    <p className="font-medium text-emerald-700">{formatItemPrice(item)}</p>
                  </VisualCard>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/booking/wisata?category=tiket"
                  className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Booking Tiket & Wahana
                </Link>
              </div>
            </Section>
          )}

          {isSectionVisible(activeCategory, 'aktivitas') && activityPackages.length > 0 && (
            <Section title="Aktivitas Wisata" subtitle="Berbagai aktivitas seru" className="bg-[#f3f0e6]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activityPackages.map((item) => (
                  <VisualCard key={item.id} categoryId="aktivitas">
                    <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                    <p className="font-medium text-emerald-700">{formatItemPrice(item)}</p>
                  </VisualCard>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/booking/wisata?category=aktivitas"
                  className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Booking Aktivitas
                </Link>
              </div>
            </Section>
          )}

          {isSectionVisible(activeCategory, 'paket-edukasi') && educationPackages.length > 0 && (
            <Section title="Paket Edukasi & Edu Trip" subtitle="Paket lengkap untuk studi wisata" className="nature-pattern">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {educationPackages.map((item) => (
                  <VisualCard key={item.id} categoryId="paket-edukasi">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        {item.note && (
                          <p className="mt-1 text-sm leading-6 text-gray-600">{item.note}</p>
                        )}
                      </div>
                      <p className="font-bold text-emerald-700 sm:whitespace-nowrap">{formatItemPrice(item)}</p>
                    </div>
                  </VisualCard>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/booking/wisata?category=paket-edukasi"
                  className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Booking Paket Edukasi
                </Link>
              </div>
            </Section>
          )}

          {isSectionVisible(activeCategory, 'sewa-tempat') && rentalPackages.length > 0 && (
            <Section title="Sewa Tempat & Aula" subtitle="Berbagai pilihan ruangan untuk acara Anda" className="bg-[#f3f0e6]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rentalPackages.map((item) => (
                  <VisualCard key={item.id} categoryId="sewa-tempat" className="text-center">
                    <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                    {item.capacity && <p className="mb-1 text-xs text-gray-600">Kapasitas {item.capacity}</p>}
                    <p className="font-medium text-emerald-700">{formatItemPrice(item)}</p>
                  </VisualCard>
                ))}
              </div>

              {homestayPackages.length > 0 && (
                <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/90 p-4 text-sm text-gray-700">
                  <p className="font-medium">Informasi Penginapan</p>
                  <p>Check-in: 14.00 | Check-out: 12.00</p>
                  <p>Extra bed (100x220): Rp25.000 | Over kapasitas: Rp10.000/orang</p>
                  <p className="mt-1 text-xs text-gray-500">Harga weekday, weekend, dan hari libur dapat berbeda.</p>
                </div>
              )}

              <div className="mt-6 text-center">
                <Link
                  href="/booking/wisata?category=sewa-tempat"
                  className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Booking Sewa Tempat
                </Link>
              </div>
            </Section>
          )}

          <Section className="bg-[#f3f0e6]">
            <div className="text-center">
              <Link href="/booking/wisata" className="btn-primary text-lg">
                Booking Sekarang
              </Link>
            </div>
          </Section>
        </>
      )}
    </>
  )
}
