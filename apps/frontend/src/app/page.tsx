import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ShoppingBagIcon,
  TicketIcon,
} from '@heroicons/react/24/outline'
import HomeHero from '@/components/HomeHero'
import HomeFeaturedWisata from '@/components/HomeFeaturedWisata'
import HomeHomestayInfo from '@/components/HomeHomestayInfo'
import Section from '@/components/Section'
import { getAllPosts } from '@/lib/content'

const upgradeFeatures = [
  {
    title: 'Booking Wisata',
    description: 'Pesan paket kunjungan secara online dan dapatkan konfirmasi tanpa antre.',
    href: '/booking/wisata',
    label: 'Mulai booking',
    icon: TicketIcon,
  },
  {
    title: 'Cek Jadwal',
    description: 'Lihat ketersediaan tanggal agar kunjungan keluarga atau rombongan lebih terencana.',
    href: '/jadwal',
    label: 'Lihat jadwal',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Produk Kalikesek',
    description: 'Beli gula aren, hasil pertanian, makanan, dan produk warga dari satu tempat.',
    href: '/toko',
    label: 'Buka toko',
    icon: ShoppingBagIcon,
  },
]

export default function HomePage() {
  const newsItems = getAllPosts()
    .filter((post) => post.published !== false)
    .slice(0, 3)
    .map((post) => ({
      title: post.title,
      excerpt: post.excerpt,
      image: post.image ?? '/images/village-landscape.jpg',
      href: `/blog/${post.slug}`,
      category: post.category ?? 'Artikel',
    }))

  return (
    <>
      <HomeHero />

      <Section
        id="wisata-home"
        title="Wisata Kalikesek"
        subtitle="Beragam pengalaman alam, pertanian, dan budaya yang dikelola bersama oleh masyarakat Kalikesek."
        className="nature-pattern"
      >
        <HomeFeaturedWisata />
        <div className="mt-10 text-center">
          <Link href="/wisata" className="btn-outline">
            Lihat Semua Wisata
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      <section id="layanan-digital" className="bg-[#f3f0e6] py-16 md:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center" data-reveal="up">
            <p className="eyebrow">Pembaruan layanan</p>
            <h2 className="font-script mt-2 text-5xl leading-none text-orange-500 md:text-6xl">
              Lebih Mudah Merencanakan Kunjungan
            </h2>
            <p className="mt-4 text-sm leading-7 text-gray-600">
              Tampilan tetap membawa suasana situs Arenan Kalikesek, dengan layanan digital baru
              yang langsung dapat digunakan pengunjung.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3" data-reveal="up" data-reveal-delay="1">
            {upgradeFeatures.map((feature) => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="motion-card group rounded-[1.5rem] border border-emerald-950/5 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(12,54,27,0.55)] sm:p-7"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition group-hover:bg-orange-500 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-emerald-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600">{feature.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-600">
                    {feature.label}
                    <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section id="paket-gula-aren" className="relative overflow-hidden bg-[#173822] text-white">
        <div className="grid lg:min-h-[620px] lg:grid-cols-2">
          <div
            className="relative min-h-[320px] overflow-hidden sm:min-h-[390px] lg:order-2 lg:min-h-full"
            data-reveal="scale"
            data-gallery-reveal
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              data-gallery-media
              style={{ backgroundImage: 'url(/images/village-tradition.jpg)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#173822]/45 to-transparent" />
          </div>
          <div className="flex items-center px-5 py-12 sm:px-12 sm:py-16 lg:px-16 xl:pl-[max(4rem,calc((100vw-80rem)/2))]" data-reveal="left">
            <div className="max-w-xl">
              <p className="eyebrow !text-orange-300">Warisan dari alam</p>
              <h2 className="font-script mt-3 text-5xl leading-none text-orange-400 sm:text-6xl">
                Paket Wisata Gula Aren
              </h2>
              <p className="mt-6 text-lg font-medium leading-8 text-white/90">
                Ikuti perjalanan nira dari pohon aren hingga menjadi gula tradisional khas
                Kalikesek.
              </p>
              <p className="mt-4 text-sm leading-7 text-white/65">
                Bertemu petani, melihat proses penyadapan, memasak nira, dan membawa pulang cerita
                tentang pengetahuan lokal yang terus dijaga.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/eduwisata-gula-aren" className="btn-secondary">
                  Lihat Pengalaman
                </Link>
                <Link
                  href="/booking/wisata"
                  className="inline-flex items-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
                >
                  Pesan Paket
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section
        id="playlist"
        title="Playlist Arenan Kalikesek"
        subtitle="Lihat lebih dekat suasana desa, kegiatan warga, dan pengalaman wisata yang menunggu Anda."
        className="nature-pattern"
      >
        <div className="grid overflow-hidden rounded-[1.75rem] bg-white shadow-[0_22px_60px_-36px_rgba(12,54,27,0.55)] lg:grid-cols-[1.35fr_0.65fr]">
          <div className="bg-black">
            <video
              className="aspect-video h-full w-full object-cover"
              controls
              preload="none"
              poster="/images/playlist-poster.jpg"
            >
              <source
                src="https://arenankalikesek.com/wp-content/uploads/2023/08/lv_0_20230624194513.mp4"
                type="video/mp4"
              />
              Browser Anda belum mendukung pemutar video.
            </video>
          </div>
          <div className="flex items-center p-7 md:p-10">
            <div>
              <p className="eyebrow">Cerita dalam gambar</p>
              <h3 className="mt-4 text-2xl font-semibold leading-snug text-emerald-950">
                Suasana Kalikesek yang hangat dan bersahaja
              </h3>
              <p className="mt-4 text-sm leading-7 text-gray-600">
                Mulai dari hamparan sawah, wisata air, hingga kebersamaan warga—semuanya menjadi
                bagian dari pengalaman Arenan Kalikesek.
              </p>
              <Link href="/wisata" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-orange-600">
                Temukan aktivitasnya
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="berita"
        title="News Arenan Kalikesek"
        subtitle="Cerita terbaru tentang wisata, masyarakat, dan kegiatan yang tumbuh dari desa."
        className="bg-[#f3f0e6]"
      >
        <div className="grid gap-5 md:grid-cols-3">
          {newsItems.map((item) => (
            <article
              key={item.title}
              className="motion-card group flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_42px_-28px_rgba(12,54,27,0.5)]"
            >
              <Link
                href={item.href}
                aria-label={`Baca artikel ${item.title}`}
                className="block aspect-[4/3] overflow-hidden"
                data-gallery-reveal
              >
                <div
                  className="h-full w-full bg-cover bg-center transition duration-700 group-hover:scale-[1.03]"
                  data-gallery-media
                  style={{ backgroundImage: `url(${item.image})` }}
                />
              </Link>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">
                  {item.category}
                </p>
                <h3 className="mt-3 line-clamp-3 text-lg font-semibold leading-7 text-emerald-950">
                  <Link href={item.href}>{item.title}</Link>
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">{item.excerpt}</p>
                <Link href={item.href} className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-emerald-700">
                  Baca selengkapnya
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section
        title="Menginap di Kalikesek"
        subtitle="Bangun pagi dengan udara sejuk dan pemandangan desa yang menenangkan."
        className="nature-pattern"
      >
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div
            className="motion-card relative min-h-[330px] overflow-hidden rounded-[1.75rem] bg-cover bg-center sm:min-h-[430px]"
            data-gallery-reveal
            style={{ backgroundImage: 'url(/images/village-sign.jpg)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white md:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                Homestay Aren 1–4
              </p>
              <h3 className="mt-2 text-2xl font-semibold">Dekat dengan alam, hangat seperti rumah</h3>
            </div>
          </div>
          <div className="motion-card flex flex-col justify-between rounded-[1.75rem] bg-white p-5 shadow-xl shadow-emerald-950/5 sm:p-7 md:p-9">
            <div>
              <p className="eyebrow">Informasi menginap</p>
              <h3 className="mt-4 text-2xl font-semibold text-emerald-950">
                Pilihan untuk keluarga dan rombongan
              </h3>
              <HomeHomestayInfo />
            </div>
            <Link href="/booking/wisata" className="btn-primary mt-8 w-full">
              Cek Ketersediaan
            </Link>
          </div>
        </div>
      </Section>

      <Section
        title="Mitra Kami"
        subtitle="Bertumbuh bersama masyarakat, akademisi, dan para penggerak desa."
        className="bg-white"
      >
        <div className="flex flex-wrap items-center justify-center gap-9 md:gap-14">
          <Image
            src="/images/logo-arenan-kalikesek.png"
            alt="Arenan Kalikesek"
            width={320}
            height={320}
            className="h-16 w-auto opacity-65 grayscale transition-all hover:opacity-100 hover:grayscale-0"
          />
          <Image
            src="/images/Universitas-Diponegoro-Semarang-Logo.png"
            alt="Universitas Diponegoro"
            width={1000}
            height={1000}
            className="h-16 w-auto opacity-65 grayscale transition-all hover:opacity-100 hover:grayscale-0"
          />
          <Image
            src="/images/logo-bumdes.png"
            alt="BUMDes"
            width={320}
            height={320}
            className="h-16 w-auto rounded-full opacity-65 transition-all hover:opacity-100"
          />
          <Image
            src="/images/logo-karang-taruna.png"
            alt="Karang Taruna"
            width={640}
            height={625}
            className="h-16 w-auto opacity-65 grayscale transition-all hover:opacity-100 hover:grayscale-0"
          />
        </div>
      </Section>

      <Section id="kontak" className="bg-[#f3f0e6]">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#f47c12] px-6 py-12 text-center text-white shadow-2xl shadow-orange-900/15 md:px-12 md:py-16">
          <div className="relative z-10 mx-auto max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/75">
              Rencanakan kunjungan
            </p>
            <h2 className="font-script mt-3 text-5xl leading-none md:text-6xl">
              Sampai Jumpa di Kalikesek
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/85">
              Kalikesek, Sriwulan, Kecamatan Limbangan, Kabupaten Kendal, Jawa Tengah 51383.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="https://wa.me/6285741171957"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-50"
              >
                Hubungi WhatsApp
              </a>
              <a
                href="https://goo.gl/maps/c95gAF5YwZXam9Pn6"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full border border-white/40 px-6 py-3 text-sm font-semibold transition hover:bg-white/10"
              >
                Buka Google Maps
              </a>
            </div>
          </div>
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full border-[40px] border-white/10" />
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full border-[32px] border-white/10" />
        </div>
      </Section>
    </>
  )
}
