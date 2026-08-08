'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bars3Icon, ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/outline'

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Wisata', href: '/wisata' },
  { label: 'Toko', href: '/toko' },
  { label: 'Blog', href: '/blog' },
  { label: 'Kontak', href: '/kontak' },
  { label: 'WebGIS', href: '/webgis' },
]

const mobileNavItems = [
  ...navItems,
  { label: 'Jadwal', href: '/jadwal' },
  { label: 'Riwayat Booking', href: '/booking' },
]

const transparentHeroRoutes = new Set([
  '/',
  '/wisata',
  '/booking/wisata',
  '/booking',
  '/jadwal',
  '/toko',
  '/blog',
  '/kontak',
  '/webgis',
])

function isNavPathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [cartCount, setCartCount] = useState(0)
  const pathname = usePathname()
  const hasTransparentHero = transparentHeroRoutes.has(pathname)

  useEffect(() => {
    const syncCartCount = () => {
      try {
        const tokoCart = JSON.parse(sessionStorage.getItem('toko-cart') || '[]')
        const bookingCart = JSON.parse(sessionStorage.getItem('wisata-cart') || '[]')
        const tokoTotal = tokoCart.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)
        const bookingTotal = bookingCart.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)
        setCartCount(tokoTotal + bookingTotal)
      } catch {
        setCartCount(0)
      }
    }

    syncCartCount()
    window.addEventListener('storage', syncCartCount)
    window.addEventListener('cart-updated', syncCartCount)
    return () => {
      window.removeEventListener('storage', syncCartCount)
      window.removeEventListener('cart-updated', syncCartCount)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 64)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setPendingHref(null)
      setIsOpen(false)
    })
    return () => {
      cancelled = true
    }
  }, [pathname])

  const elevated = !hasTransparentHero || isScrolled
  const isSelected = (href: string) =>
    pendingHref ? pendingHref === href : isNavPathActive(pathname, href)
  const selectMenu = (href: string, closeMobile = false) => {
    if (!isNavPathActive(pathname, href)) setPendingHref(href)
    if (closeMobile) setIsOpen(false)
  }

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
          <Link
            href="/"
            className="site-brand flex items-center gap-3"
            aria-label="Kembali ke beranda"
            onClick={() => selectMenu('/')}
          >
            <Image
              src="/images/logo-arenan-kalikesek.png"
              alt="Arenan Kalikesek"
              width={320}
              height={320}
              priority
              loading="eager"
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
            <nav className="flex items-center gap-0.5" aria-label="Navigasi utama">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isNavPathActive(pathname, item.href) ? 'page' : undefined}
                  onClick={() => selectMenu(item.href)}
                  className={`site-nav-link rounded-full px-3 py-2 text-[13px] font-semibold ${
                    isSelected(item.href)
                      ? elevated
                        ? 'site-nav-link--active nav-choice-active bg-orange-500/15 text-orange-700 ring-1 ring-inset ring-orange-400/25 backdrop-blur-md'
                        : 'site-nav-link--active nav-choice-active bg-orange-400/20 text-orange-100 ring-1 ring-inset ring-orange-300/25 backdrop-blur-md'
                      : elevated
                        ? 'text-emerald-800 hover:bg-orange-500/10 hover:text-orange-700'
                        : 'text-orange-200 hover:bg-orange-400/15 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <span className={`mx-1 h-7 w-px ${elevated ? 'bg-gray-200' : 'bg-white/25'}`} />
            <Link
              href="/jadwal"
              aria-current={isNavPathActive(pathname, '/jadwal') ? 'page' : undefined}
              onClick={() => selectMenu('/jadwal')}
              className={`site-nav-link rounded-full px-3 py-2 text-[13px] font-semibold ${
                isSelected('/jadwal')
                  ? elevated
                    ? 'site-nav-link--active nav-choice-active bg-orange-500/15 text-orange-700 ring-1 ring-inset ring-orange-400/25 backdrop-blur-md'
                    : 'site-nav-link--active nav-choice-active bg-orange-400/20 text-orange-100 ring-1 ring-inset ring-orange-300/25 backdrop-blur-md'
                  : elevated
                    ? 'text-emerald-800 hover:bg-orange-500/10 hover:text-orange-700'
                    : 'text-white hover:bg-orange-400/15 hover:text-orange-200'
              }`}
            >
              Jadwal
            </Link>
<Link
              href="/booking"
              aria-current={isNavPathActive(pathname, '/booking') ? 'page' : undefined}
              onClick={() => selectMenu('/booking')}
              className={`nav-booking-button rounded-full px-4 py-2.5 text-[13px] font-semibold ${
                isSelected('/booking')
                  ? 'nav-booking-button--active bg-orange-500/15 text-orange-700 ring-1 ring-inset ring-orange-400/25 backdrop-blur-md'
                  : 'bg-orange-500 text-white shadow-lg shadow-orange-950/15'
              }`}
            >
              Riwayat Booking
            </Link>

            {cartCount > 0 && (
              <Link
                href={pathname.startsWith('/toko') ? '/toko' : '/booking/wisata'}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-cart-modal'))
                }}
                className="relative inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-md transition hover:bg-emerald-800 active:scale-95"
              >
                <ShoppingCartIcon className="h-4 w-4" />
                <span>Keranjang</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {cartCount > 0 && (
              <Link
                href={pathname.startsWith('/toko') ? '/toko' : '/booking/wisata'}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-cart-modal'))
                }}
                aria-label="Buka keranjang"
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-white shadow-md transition hover:bg-emerald-800 active:scale-95"
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              </Link>
            )}

            <button
              type="button"
              aria-label={isOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={isOpen}
              className={`mobile-menu-trigger rounded-full p-2.5 shadow-lg transition ${
                isOpen
                  ? 'bg-[#f47c12]/80 text-white ring-1 ring-inset ring-orange-200/45 backdrop-blur-xl'
                  : elevated
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
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
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 top-18 md:top-20 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        aria-hidden={!isOpen}
        className={`mobile-nav-shell absolute inset-x-0 top-full z-50 grid lg:hidden ${
          isOpen ? 'mobile-nav-shell--open' : ''
        }`}
      >
        <div className="overflow-hidden">
          <div className="mobile-nav-panel mx-auto mt-1 max-h-[calc(100dvh-5.75rem)] w-[calc(100%-1rem)] space-y-0.5 overflow-y-auto rounded-b-[1.35rem] rounded-t-md border border-orange-200/35 bg-[rgba(244,124,18,0.72)] p-2 shadow-[0_22px_55px_-24px_rgba(105,42,0,0.82)] backdrop-blur-xl">
              {mobileNavItems.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  tabIndex={isOpen ? 0 : -1}
                  aria-current={isNavPathActive(pathname, item.href) ? 'page' : undefined}
                  className={`mobile-nav-link block rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    isSelected(item.href)
                      ? 'mobile-nav-link--active bg-[#f47c12]/95 text-white ring-1 ring-inset ring-orange-200/50 shadow-sm'
                      : 'text-white/90 hover:bg-[#f47c12]/75 hover:text-white'
                  }`}
                  style={{ '--mobile-link-order': index } as React.CSSProperties}
                  onClick={() => selectMenu(item.href, true)}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </header>
  )
}
