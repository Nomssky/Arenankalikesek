'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Wisata', href: '/wisata' },
  { label: 'Toko', href: '/toko' },
  { label: 'Blog', href: '/blog' },
  { label: 'Kontak', href: '/kontak' },
  { label: 'WebGIS', href: '/webgis' },
]

const mobileNavItems = [
  ...navItems.slice(0, 2),
  { label: 'Booking', href: '/booking/wisata' },
  { label: 'Jadwal', href: '/jadwal' },
  ...navItems.slice(2),
]

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const elevated = !isHome || isScrolled || isOpen

  return (
    <header
      className={`fixed left-0 top-0 z-50 w-screen max-w-full transition-all duration-300 ${
        elevated
          ? 'bg-white/95 shadow-[0_8px_30px_rgba(31,72,42,0.08)] backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="container-page">
        <div className={`flex items-center justify-between transition-all duration-300 ${elevated ? 'h-18 md:h-20' : 'h-20 md:h-28'}`}>
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo-arenan-kalikesek.png"
              alt="Arenan Kalikesek"
              width={320}
              height={320}
              className={`w-auto transition-all duration-300 ${elevated ? 'h-12' : 'h-14 md:h-16'}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = ''
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <span className={`h-10 w-px hidden sm:block ${elevated ? 'bg-gray-200' : 'bg-white/30'}`} />
            <Image
              src="/images/Universitas-Diponegoro-Semarang-Logo.png"
              alt="Universitas Diponegoro"
              width={1000}
              height={1000}
              className={`hidden sm:block w-auto transition-all duration-300 ${elevated ? 'h-10' : 'h-11 md:h-12'}`}
            />
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <nav className="flex items-center gap-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${
                    pathname === item.href
                      ? 'bg-emerald-50 text-emerald-700'
                      : elevated
                        ? 'text-orange-600 hover:bg-emerald-50 hover:text-emerald-700'
                        : 'text-orange-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <span className={`mx-1 h-7 w-px ${elevated ? 'bg-gray-200' : 'bg-white/25'}`} />
            <Link
              href="/jadwal"
              className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${
                pathname === '/jadwal'
                  ? 'text-emerald-700'
                  : elevated
                    ? 'text-emerald-800 hover:text-orange-600'
                    : 'text-white hover:text-orange-300'
              }`}
            >
              Jadwal
            </Link>
            <Link href="/booking/wisata" className="rounded-full bg-orange-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-orange-950/15 transition hover:-translate-y-0.5 hover:bg-orange-600">
              Booking
            </Link>
          </div>

          <button
            type="button"
            aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
            className={`lg:hidden p-2.5 rounded-full shadow-lg transition ${elevated ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-gray-100 bg-white shadow-xl lg:hidden">
          <div className="container-page space-y-1 py-4">
            {mobileNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-3 text-sm font-semibold rounded-xl transition-colors ${pathname === item.href ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700 hover:text-emerald-700 hover:bg-emerald-50'}`}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
