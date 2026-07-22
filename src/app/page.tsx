import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

const wisataItems = [
  { name: 'Berkuda', icon: '🐴', desc: 'Rp15.000 - Rp20.000' },
  { name: 'Kolam Renang', icon: '🏊', desc: 'Rp5.000' },
  { name: 'Rainbow Slide', icon: '🎢', desc: 'Rp10.000' },
  { name: 'Taman Kelinci', icon: '🐰', desc: 'Rp10.000' },
  { name: 'Kereta Sawah', icon: '🚜', desc: 'Rp15.000' },
  { name: 'Terapi Ikan', icon: '🐟', desc: 'Gratis' },
  { name: 'Wahana Anak', icon: '🎠', desc: 'Rp10.000' },
  { name: 'Jeep Wisata', icon: '🚙', desc: 'Rp120.000' },
]

const homestayItems = [
  {
    name: 'Homestay Aren 1',
    capacity: '2 orang',
    price: 'Rp200rb - Rp300rb',
  },
  {
    name: 'Homestay Aren 2',
    capacity: '2 orang',
    price: 'Rp200rb - Rp300rb',
  },
  {
    name: 'Homestay Aren 3',
    capacity: '4 orang',
    price: 'Rp375rb - Rp500rb',
  },
  {
    name: 'Homestay Aren 4',
    capacity: '4 orang',
    price: 'Rp450rb - Rp575rb',
  },
]

export default function HomePage() {
  return (
    <>
      <Hero
        title="Arenan Kalikesek"
        subtitle="Desa Wisata Sriwulan — Nikmati keindahan alam pegunungan, persawahan hijau, dan berbagai aktivitas wisata menarik"
        image="/images/hero-bg.jpg"
        height="lg"
      >
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/wisata" className="btn-primary">
            Lihat Wisata
          </Link>
          <Link href="/booking/wisata" className="btn-secondary">
            Booking Sekarang
          </Link>
        </div>
      </Hero>

      <Section
        title="Wisata Kalikesek"
        subtitle="Berbagai pilihan aktivitas wisata seru untuk liburan Anda"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {wisataItems.map((item) => (
            <div key={item.name} className="card p-6 text-center hover:-translate-y-1 transition-transform">
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-sm text-emerald-600 font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/wisata" className="btn-outline">
            Lihat Semua Wisata
          </Link>
        </div>
      </Section>

      <Section title="Homestay & Penginapan" subtitle="Menginap nyaman dengan pemandangan alam yang indah" className="bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {homestayItems.map((item) => (
            <div key={item.name} className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-2">{item.name}</h3>
              <p className="text-sm text-gray-600 mb-1">{item.capacity}</p>
              <p className="text-sm text-emerald-600 font-medium">{item.price}/malam</p>
              <p className="text-xs text-gray-400 mt-2">Weekday / Weekend / Holiday</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Eduwisata Gula Aren" subtitle="Belajar proses pembuatan gula aren tradisional">
        <div className="bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl p-8 md:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-gray-700 mb-6 leading-relaxed">
              Dikelilingi oleh pemandangan alam pegunungan yang membiru indah, persawahan yang hijau
              menyejukkan mata, deretan hutan pinus di kejauhan ditambah gemericik air sungai
              menjadikan Arenan Kalikesek tempat pilihan untuk melepas penat.
            </p>
            <Link href="/eduwisata-gula-aren" className="btn-primary">
              Pesan Paket Wisata Gula Aren
            </Link>
          </div>
        </div>
      </Section>

      <Section title="Mitra Kami" className="bg-gray-50">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          <img
            src="/images/logo-arenan-kalikesek.png"
            alt="Arenan Kalikesek"
            className="h-16 w-auto opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all"
          />
          <img
            src="/images/Universitas-Diponegoro-Semarang-Logo.png"
            alt="Universitas Diponegoro"
            className="h-16 w-auto opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all"

          />
        </div>
      </Section>

      <Section id="kontak" title="Kontak Kami" subtitle="Hubungi kami untuk info lebih lanjut">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="card p-8">
            <h3 className="font-semibold text-lg mb-4">Alamat</h3>
            <p className="text-gray-600 mb-6">
              Kalikesek, Sriwulan, Kec. Limbangan
              <br />
              Kabupaten Kendal, Jawa Tengah, 51383
            </p>
            <a
              href="https://goo.gl/maps/c95gAF5YwZXam9Pn6"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-sm"
            >
              Lihat di Google Maps
            </a>
          </div>
          <div className="card p-8">
            <h3 className="font-semibold text-lg mb-4">Hubungi Kami</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">WhatsApp</p>
                <a
                  href="https://wa.me/6285741171957"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  +62 857-4117-1957
                </a>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <a
                  href="mailto:arenankalikesek@gmail.com"
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  arenankalikesek@gmail.com
                </a>
              </div>
              <div className="flex gap-3 pt-2">
                <a
                  href="https://www.instagram.com/arenankalikesek/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:text-pink-700 font-medium text-sm"
                >
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@arenankalikesek"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-gray-900 font-medium text-sm"
                >
                  TikTok
                </a>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
