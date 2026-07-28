'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArchiveBoxIcon,
  ArrowLeftIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  ShoppingBagIcon,
  TicketIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-medium text-red-600 transition hover:bg-red-100 sm:px-4"
    >
      <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
      <span className="hidden sm:inline">Logout</span>
    </button>
  )
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: ChartBarSquareIcon },
  { href: '/admin/bookings', label: 'Booking', icon: ClipboardDocumentListIcon },
  { href: '/admin/products', label: 'Produk', icon: ShoppingBagIcon },
  { href: '/admin/tour-packages', label: 'Paket Wisata', icon: TicketIcon },
  { href: '/admin/inventory', label: 'Inventory', icon: ArchiveBoxIcon },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/admin') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [drawerOpen])

  if (isLoginPage) return children

  return (
    <div className="admin-shell flex min-h-screen min-w-0 bg-gray-50 text-gray-900">
      <button
        type="button"
        aria-label="Tutup menu admin"
        tabIndex={drawerOpen ? 0 : -1}
        className={`fixed inset-0 z-40 bg-emerald-950/45 backdrop-blur-sm transition lg:hidden ${
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      <aside
        id="admin-navigation"
        data-lenis-prevent
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(19rem,calc(100vw-3rem))] shrink-0 flex-col bg-white shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-lg ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-16 items-center justify-between gap-3 border-b px-5 lg:px-6">
          <Link
            href="/admin"
            onClick={() => setDrawerOpen(false)}
            className="flex min-w-0 items-center gap-3 font-bold text-emerald-900"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ChartBarSquareIcon className="h-5 w-5" />
            </span>
            <span className="truncate">Admin Kalikesek</span>
          </Link>
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Navigasi admin">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setDrawerOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100'
                    : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
          <hr className="my-4 border-gray-200" />
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Kembali ke Situs
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Buka menu admin"
              aria-expanded={drawerOpen}
              aria-controls="admin-navigation"
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 lg:hidden"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-emerald-900 sm:text-base">
                Panel Admin
              </p>
              <p className="hidden text-xs text-gray-500 sm:block">Arenan Kalikesek</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 sm:px-3"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="hidden sm:inline">Lihat Situs</span>
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </a>
            <LogoutButton />
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
