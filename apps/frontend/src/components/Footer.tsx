'use client'

import Link from 'next/link'
import Image from 'next/image'

const quickLinks = [
  { label: 'Wisata', href: '/wisata' },
  { label: 'Jadwal', href: '/jadwal' },
  { label: 'Toko', href: '/toko' },
  { label: 'Blog', href: '/blog' },
  { label: 'Kontak', href: '/kontak' },
  { label: 'WebGIS', href: '/webgis' },
  { label: 'Eduwisata Gula Aren', href: '/eduwisata-gula-aren' },
]

const bookingLinks = [
  { label: 'Booking Wisata', href: '/booking/wisata' },
  { label: 'Cek Jadwal', href: '/jadwal' },
]

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#173822] text-white/70">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, white 0 1px, transparent 2px)', backgroundSize: '28px 28px' }} />
      <div className="relative container-page py-14 md:py-18" data-footer-reveal>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-[1.35fr_0.8fr_1fr] md:gap-10">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/images/logo-arenan-kalikesek.png"
                alt="Arenan Kalikesek"
                width={320}
                height={320}
                className="h-16 w-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <p className="text-sm leading-7 max-w-sm">
              Desa Wisata Arenan Kalikesek Sriwulan menawarkan keindahan alam
              pegunungan, persawahan hijau, dan berbagai aktivitas wisata
              menarik.
            </p>
          </div>

          <div>
            <h3 className="font-script text-3xl text-orange-400 mb-4">Jelajahi</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-orange-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-script text-3xl text-orange-400 mb-4">Reservasi</h3>
            <ul className="space-y-2">
              {bookingLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-orange-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="text-white font-semibold mt-6 mb-3">Kontak Kami</h3>
            <ul className="space-y-2 text-sm">
              <li>Kalikesek, Sriwulan, Kec. Limbangan</li>
              <li>Kabupaten Kendal, Jawa Tengah 51383</li>
              <li>
                <a
                  href="https://wa.me/6285741171957"
                  className="hover:text-orange-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +62 857-4117-1957
                </a>
              </li>
              <li>
                <a
                  href="mailto:arenankalikesek@gmail.com"
                  className="hover:text-orange-300 transition-colors"
                >
                  arenankalikesek@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="container-page py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} Arenan Kalikesek. All rights
            reserved.
          </p>
          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/arenankalikesek/"
              aria-label="Instagram Arenan Kalikesek"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-pink-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="https://www.tiktok.com/@arenankalikesek"
              aria-label="TikTok Arenan Kalikesek"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
