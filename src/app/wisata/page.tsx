'use client'

import { useState } from 'react'
import Link from 'next/link'
import CategoryVisualHeader from '@/components/CategoryVisualHeader'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { getServiceCategory, serviceCategories } from '@/lib/service-categories'

const wisataCategoryIds = new Set([
  'semua',
  'tiket',
  'aktivitas',
  'paket-edukasi',
  'sewa-tempat',
  'homestay',
  'camping',
  'fishing',
])

const wisataCategories = serviceCategories.filter((category) => wisataCategoryIds.has(category.id))

const ticketItems = [
  { name: 'HTM (Tiket Masuk)', price: 'Rp5.000' },
  { name: 'Kolam Anak', price: 'Rp5.000' },
  { name: 'Berenang', price: 'Rp5.000' },
  { name: 'Wahana Permainan Anak', price: 'Rp10.000/wahana' },
  { name: 'Tangkap Ikan', price: 'Rp10.000' },
  { name: 'Terapi Ikan', price: 'Gratis' },
  { name: 'Keceh Kali (Bermain Sungai)', price: 'Gratis' },
]

const activityItems = [
  { name: 'Tanam Padi', price: 'Rp15.000' },
  { name: 'Tanam Sayur', price: 'Rp10.000' },
  { name: 'Cooking Class', price: 'Rp25.000' },
  { name: 'Fun Game (2 jam)', price: 'Rp15.000' },
  { name: 'Edukasi Pembuatan Gula Aren', price: 'Rp20.000' },
]

const eduTripItems = [
  { name: 'Edu Trip Kesek 1', price: 'Rp35.000/pax' },
  { name: 'Edu Trip Kesek 2', price: 'Rp35.000/pax' },
  { name: 'Edu Trip Kesek 3', price: 'Rp50.000/pax' },
  { name: 'Edu Trip Kesek 4', price: 'Rp50.000/pax' },
  { name: 'Edu Trip Kesek 5', price: 'Rp80.000/pax' },
]

const educationPackages = [
  {
    name: 'Package Edukasi 1',
    price: 'Rp90.000/pax',
    desc: 'HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Lunch + Welcome drink',
  },
  {
    name: 'Package Edukasi 2',
    price: 'Rp100.000/pax',
    desc: 'HTM + Keceh Kali + Terapi Ikan + Fun Game + Lunch + Welcome drink',
  },
  {
    name: 'Package Edukasi 3',
    price: 'Rp120.000/pax',
    desc: 'HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Fun Game + Lunch + Welcome drink',
  },
]

const rentalItems = [
  { name: 'Pendopo', capacity: '90–100 orang', price: 'Rp100.000/jam' },
  { name: 'Pendopo Besar', capacity: '40–50 orang', price: 'Rp75.000/jam' },
  { name: 'Gazebo', capacity: '30–40 orang', price: 'Rp50.000/jam' },
  { name: 'Gazebo Bawah', capacity: '20–25 orang', price: 'Rp30.000/jam' },
  { name: 'Aula Dalam', capacity: '35–40 orang', price: 'Rp75.000/jam' },
  { name: 'Aula Teras', capacity: '35–40 orang', price: 'Rp75.000/jam' },
  { name: 'Aula Full', capacity: '60–80 orang', price: 'Rp200.000/jam' },
  { name: 'Aula Sungai', capacity: '70–90 orang', price: 'Rp100.000/jam' },
  { name: 'Outbound', price: 'Rp25.000/jam' },
  { name: 'Senam', price: 'Rp25.000/acara' },
]

const campingItems = [
  { name: 'HTM Camp', price: 'Rp5.000/orang' },
  { name: 'Spot Tenda', price: 'Rp25.000' },
  { name: 'Spot Tenda Besar', price: 'Rp40.000' },
  { name: 'Tenda 4 Orang', price: 'Rp75.000' },
]

const homestayItems = [
  {
    name: 'Aren 1 & 2',
    capacity: '2–5 orang',
    price: 'Rp200rb–Rp300rb/malam',
    facilities: 'Kamar mandi dalam, 1 bed, kipas angin, teko listrik, kopi dan teh, air mineral 2 botol.',
  },
  {
    name: 'Aren 3',
    capacity: '6–8 orang',
    price: 'Rp375rb–Rp500rb/malam',
    facilities: 'Kamar mandi dalam, 2 bed, ruang luas, kipas angin, Smart TV, teko listrik, kopi dan teh.',
  },
  {
    name: 'Aren 4',
    capacity: '8–10 orang',
    price: 'Rp450rb–Rp575rb/malam',
    facilities: 'Kamar mandi dalam, dapur, 2 kamar, ruang keluarga, kipas angin, Smart TV, dan teko listrik.',
  },
]

const fishingItems = [
  { name: 'Sewa Alat Pancing', price: 'Rp5.000' },
  { name: 'Pelet Umpan', price: 'Rp5.000' },
  { name: 'Ikan Nila', price: 'Rp38.000/kg' },
  { name: 'Ikan Bawal', price: 'Rp32.000/kg' },
  { name: 'Ikan Kalper', price: 'Rp38.000/kg' },
]

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

export default function WisataPage() {
  const [activeCategory, setActiveCategory] = useState('semua')
  const activeCategoryInfo = getServiceCategory(activeCategory)
  const showCategory = (categoryId: string) =>
    activeCategory === 'semua' || activeCategory === categoryId

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

      {showCategory('tiket') && (
        <Section title="Tiket & Wahana" subtitle="Tiket masuk dan wahana permainan" className="nature-pattern">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ticketItems.map((item) => (
              <VisualCard key={item.name} categoryId="tiket">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                <p className="font-medium text-emerald-700">{item.price}</p>
              </VisualCard>
            ))}
          </div>
        </Section>
      )}

      {showCategory('aktivitas') && (
        <Section title="Aktivitas Wisata" subtitle="Berbagai aktivitas seru" className="bg-[#f3f0e6]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activityItems.map((item) => (
              <VisualCard key={item.name} categoryId="aktivitas">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                <p className="font-medium text-emerald-700">{item.price}</p>
              </VisualCard>
            ))}
          </div>
        </Section>
      )}

      {showCategory('paket-edukasi') && (
        <Section title="Paket Edukasi & Edu Trip" subtitle="Paket lengkap untuk studi wisata" className="nature-pattern">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {eduTripItems.map((item) => (
              <VisualCard key={item.name} categoryId="paket-edukasi">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                <p className="font-medium text-emerald-700">{item.price}</p>
              </VisualCard>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Package Edukasi</h3>
            {educationPackages.map((item) => (
              <VisualCard key={item.name} categoryId="paket-edukasi">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{item.desc}</p>
                  </div>
                  <p className="font-bold text-emerald-700 sm:whitespace-nowrap">{item.price}</p>
                </div>
              </VisualCard>
            ))}
          </div>
        </Section>
      )}

      {showCategory('sewa-tempat') && (
        <Section title="Sewa Tempat & Aula" subtitle="Berbagai pilihan ruangan untuk acara Anda" className="bg-[#f3f0e6]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rentalItems.map((item) => (
              <VisualCard key={item.name} categoryId="sewa-tempat" className="text-center">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                {item.capacity && <p className="mb-1 text-xs text-gray-600">Kapasitas {item.capacity}</p>}
                <p className="font-medium text-emerald-700">{item.price}</p>
              </VisualCard>
            ))}
          </div>
        </Section>
      )}

      {showCategory('homestay') && (
        <Section title="Homestay" subtitle="Menginap nyaman dengan pemandangan alam" className="nature-pattern">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {homestayItems.map((item) => (
              <VisualCard key={item.name} categoryId="homestay" className="p-6">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                <p className="mb-2 text-sm text-gray-600">{item.capacity}</p>
                <p className="mb-2 font-bold text-emerald-700">{item.price}</p>
                <p className="text-sm leading-6 text-gray-700">{item.facilities}</p>
              </VisualCard>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/90 p-4 text-sm text-gray-700">
            <p className="font-medium">Informasi Penginapan</p>
            <p>Check-in: 14.00 | Check-out: 12.00</p>
            <p>Extra bed (100x220): Rp25.000 | Over kapasitas: Rp10.000/orang</p>
            <p className="mt-1 text-xs text-gray-500">Harga weekday, weekend, dan hari libur dapat berbeda.</p>
          </div>
        </Section>
      )}

      {showCategory('camping') && (
        <Section title="Camping" subtitle="Berkemah di alam terbuka" className="bg-[#f3f0e6]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {campingItems.map((item) => (
              <VisualCard key={item.name} categoryId="camping" className="text-center">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                <p className="font-medium text-emerald-700">{item.price}</p>
              </VisualCard>
            ))}
          </div>
        </Section>
      )}

      {showCategory('fishing') && (
        <Section title="Fishing & Kolam" subtitle="Mancing santai di Kalikesek" className="nature-pattern">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {fishingItems.map((item) => (
              <VisualCard key={item.name} categoryId="fishing" className="text-center">
                <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
                <p className="font-medium text-emerald-700">{item.price}</p>
              </VisualCard>
            ))}
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
  )
}
