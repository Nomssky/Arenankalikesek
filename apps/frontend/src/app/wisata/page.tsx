'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CategoryVisualHeader from '@/components/CategoryVisualHeader'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { getServiceCategory, serviceCategories } from '@/lib/service-categories'
import { formatPrice } from '@/lib/utils'

const accommodationCategory = {
  id: 'penginapan-camping',
  name: 'Penginapan & Camping',
  image: '/images/booking-homestay.jpg',
  description: 'Homestay, camping ground, dan glamping dengan jadwal menginap per malam.',
  position: 'center 58%',
}

const wisataCategories = [
  ...serviceCategories.filter((category) => !['homestay', 'camping', 'glamping'].includes(category.id)),
  accommodationCategory,
]

interface TourPackage {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  price_label: string
  pricing_type: string
  unit: string | null
  capacity: string | null
  note: string | null
  facilities: string[]
  rate_options: { label: string; price: number }[]
  bookable: boolean
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
      className={`card motion-card bg-cover bg-center p-5 ${className}`}
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
  return item.price_label || formatPrice(item.price)
}

// ponytail: penyembunyian tampilan (kunikan dari daftar Wahana & Aktivitas) —
// item ikan tidak dihapus dari DB; daftar tetap datang dari backend, frontend
// hanya memilih menampilkan ulang. Ceiling: jika item harus hilang total dari
// katalog, beri `available=false` di DB (admin Produk).
const HIDDEN_ACTIVITY_IDS = new Set([
  'terapi-ikan',
  'kolam-pancing',
  'sewa-alat-pancing',
  'pelet-umpan',
])

const sectionCategories: Record<string, string[]> = {
  aktivitas: ['aktivitas', 'gratis', 'fishing'],
  'paket-edukasi': ['paket-edukasi', 'paket-kegiatan'],
  'sewa-tempat': ['area-kegiatan', 'tempat-pertemuan'],
  'penginapan-camping': ['homestay', 'camping', 'glamping'],
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
  const [extraGuestFee, setExtraGuestFee] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const activeCategoryInfo = activeCategory === accommodationCategory.id
    ? accommodationCategory
    : getServiceCategory(activeCategory)

  async function fetchPackages() {
    setLoading(true)
    setError('')
    try {
      const [res, settingsRes] = await Promise.all([
        fetch('/api/tour-packages?available=true'),
        fetch('/api/booking-config'),
      ])
      if (res.ok) {
        setPackages(await res.json())
      } else {
        setError('Gagal memuat paket wisata')
      }
      if (settingsRes.ok) {
        const payload = await settingsRes.json() as { settings?: Record<string, number | null> }
        setExtraGuestFee(payload.settings?.['homestay.aren_1.extra_guest_fee'] ?? null)
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
    aktivitas: [],
    'paket-edukasi': [],
    'sewa-tempat': [],
    'penginapan-camping': [],
  }

  for (const pkg of packages) {
    if (!pkg.available) continue
    if (['extra-bed', 'tambahan-tamu'].includes(pkg.id)) continue
    if (HIDDEN_ACTIVITY_IDS.has(pkg.id)) continue
    for (const [sectionKey, cats] of Object.entries(sectionCategories)) {
      if (cats.includes(pkg.category)) {
        packagesBySection[sectionKey].push(pkg)
        break
      }
    }
  }

  const filterActiveCategory = (items: TourPackage[]) =>
    activeCategory === 'semua'
      ? items
      : items.filter((item) => item.category === activeCategory)

  const activityPackages = filterActiveCategory(packagesBySection.aktivitas)
  const educationPackages = filterActiveCategory(packagesBySection['paket-edukasi'])
  const rentalPackages = filterActiveCategory(packagesBySection['sewa-tempat'])
  const accommodationPackages = activeCategory === 'semua' || activeCategory === 'penginapan-camping'
    ? packagesBySection['penginapan-camping']
    : packagesBySection['penginapan-camping'].filter((item) => item.category === activeCategory)
  const homestayPackages = accommodationPackages.filter((p) => p.category === 'homestay')

  return (
    <>
      <Hero
        title="Wisata Kalikesek"
        subtitle="Temukan berbagai pilihan aktivitas wisata seru"
        image="/images/wisata-keceh-air.jpg"
        height="full"
      />

      <Section className="relative overflow-hidden bg-[#fbfaf5]">
        <CategoryVisualHeader category={activeCategoryInfo} />
        <nav aria-label="Kategori wisata" className="flex flex-nowrap overflow-x-auto pb-2 pt-1 sm:flex-wrap sm:pb-0 gap-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          {isSectionVisible(activeCategory, 'aktivitas') && activityPackages.length > 0 && (
            <Section title="Wahana & Aktivitas" subtitle="Wahana keluarga, aktivitas alam, dan kolam pancing" className="bg-[#f3f0e6]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activityPackages.map((item) => (
                  <VisualCard key={item.id} categoryId={item.category}>
                    <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                    <p className="font-medium text-emerald-700">
                      {formatItemPrice(item)}
                      {item.unit && item.pricing_type === 'fixed' ? `/${item.unit}` : ''}
                    </p>
                    {item.note && item.note !== item.price_label && (
                      <p className="mt-1 text-xs text-gray-600">{item.note}</p>
                    )}
                  </VisualCard>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/jadwal"
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
                  <VisualCard key={item.id} categoryId={item.category}>
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        {item.note && (
                          <p className="mt-1 text-sm leading-6 text-gray-600">{item.note}</p>
                        )}
                      </div>
                      <p className="font-bold text-emerald-700 sm:whitespace-nowrap">{formatItemPrice(item)}</p>
                    </div>
                    {item.facilities.length > 0 && (
                      <p className="mt-3 text-xs leading-5 text-gray-600">
                        <strong>Fasilitas:</strong> {item.facilities.join(', ')}
                      </p>
                    )}
                  </VisualCard>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/jadwal"
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
                  <VisualCard key={item.id} categoryId={item.category} className="text-center">
                    <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                    {item.capacity && <p className="mb-1 text-xs text-gray-600">Kapasitas {item.capacity}</p>}
                    <p className="font-medium text-emerald-700">
                      {formatItemPrice(item)}
                      {item.unit && item.pricing_type === 'fixed' ? `/${item.unit}` : ''}
                    </p>
                    {item.rate_options.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1">
                        {item.rate_options.map((rate) => (
                          <span key={rate.label} className="rounded-full bg-white/80 px-2 py-1 text-[10px] text-gray-700">
                            {rate.label}: {formatPrice(rate.price)}
                          </span>
                        ))}
                      </div>
                    )}
                  </VisualCard>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/jadwal"
                  className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Booking Sewa Tempat
                </Link>
              </div>
            </Section>
          )}

          {isSectionVisible(activeCategory, 'penginapan-camping') && accommodationPackages.length > 0 && (
            <Section title="Penginapan & Camping" subtitle="Homestay, camping ground, dan glamping dengan booking per malam" className="bg-[#f3f0e6]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {accommodationPackages.map((item) => (
                  <VisualCard key={item.id} categoryId={item.category} className="text-center">
                    <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                    {item.capacity && <p className="mb-1 text-xs text-gray-600">Kapasitas {item.capacity}</p>}
                    <p className="font-medium text-emerald-700">{formatItemPrice(item)}{item.unit ? `/${item.unit}` : ''}</p>
                    {item.rate_options.length > 0 && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1">
                        {item.rate_options.map((rate) => <span key={rate.label} className="rounded-full bg-white/80 px-2 py-1 text-[10px] text-gray-700">{rate.label}: {formatPrice(rate.price)}</span>)}
                      </div>
                    )}
                    {!item.bookable && <p className="mt-2 text-xs font-medium text-orange-600">Harga belum tersedia — hubungi pengelola.</p>}
                  </VisualCard>
                ))}
              </div>
{homestayPackages.length > 0 && (
                <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/90 p-4 text-sm text-gray-700">
                  <p className="font-medium">Informasi Penginapan</p>
                  <p>Check-in: 14.00 | Check-out: 12.00</p>
                  <p>
                    Aren 1/2: kapasitas dasar 5 orang
                    {extraGuestFee === null ? '.' : `, tambahan ${formatPrice(extraGuestFee)}/orang untuk satu booking.`}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Total akhir dihitung dari harga database dan tanggal yang dipilih.</p>
                </div>
              )}
              {accommodationPackages.some((p) => ['camping', 'glamping'].includes(p.category)) && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/90 p-4 text-sm text-gray-700">
                  <p className="font-medium">Informasi Camping</p>
                  <p>Bawa tenda sendiri: membayar HTM camping + spot tenda.</p>
                  <p>Sewa tenda: membayar biaya sewa tenda.</p>
                  <p className="mt-1 text-xs text-gray-500">Biaya final disesuaikan kebijakan admin ketika booking diproses.</p>
                </div>
              )}
              <div className="mt-6 text-center"><Link href="/jadwal" className="inline-block rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700">Booking Penginapan & Camping</Link></div>
            </Section>
          )}

          <Section className="bg-[#f3f0e6]">
            <div className="text-center">
              <Link href="/jadwal" className="btn-primary text-lg">
                Booking Sekarang
              </Link>
            </div>
          </Section>
        </>
      )}
    </>
  )
}
