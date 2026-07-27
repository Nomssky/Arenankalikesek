'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
    >
      Logout
    </button>
  )
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/bookings', label: 'Booking', icon: '📋' },
  { href: '/admin/products', label: 'Produk', icon: '🛒' },
  { href: '/admin/tour-packages', label: 'Paket Wisata', icon: '🎫' },
  { href: '/admin/inventory', label: 'Inventory', icon: '📦' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-64 flex-shrink-0 bg-white shadow-lg lg:block">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="text-xl">🌿</span>
          <span className="font-bold text-emerald-900">Admin Kalikesek</span>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <hr className="my-4 border-gray-200" />
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <span>←</span>
            Kembali ke Situs
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
          <div className="lg:hidden">
            <span className="font-bold text-emerald-900">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
              target="_blank"
            >
              Lihat Situs →
            </a>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t bg-white px-2 py-2 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600"
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
