'use client'

import { useEffect, useState } from 'react'
import { formatPrice, formatDate } from '@/lib/utils'

interface Booking {
  id: string
  customer_name: string
  customer_phone: string
  total_amount: number
  status: string
  type: string
  created_at: string
  booking_date: string
}

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/bookings')
        const data = res.ok ? await res.json() : []
        setBookings(data)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'badge-amber',
      paid: 'badge-green',
      confirmed: 'badge-blue',
      cancelled: 'badge-red',
    }
    const labels: Record<string, string> = {
      pending: 'Menunggu',
      paid: 'Lunas',
      confirmed: 'Dikonfirmasi',
      cancelled: 'Dibatalkan',
    }
    return (
      <span className={styles[status] || 'badge-amber'}>
        {labels[status] || status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container-page py-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola booking masuk</p>
        </div>
      </div>

      <div className="container-page py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Booking', value: bookings.length, color: 'bg-blue-500' },
            { label: 'Wisata', value: bookings.filter((b) => b.type === 'wisata').length, color: 'bg-emerald-500' },
            { label: 'Toko', value: bookings.filter((b) => b.type === 'toko').length, color: 'bg-amber-500' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                <span className="text-sm text-gray-600">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {bookings.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">Belum ada booking</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="text-left p-4 font-semibold">ID</th>
                    <th className="text-left p-4 font-semibold">Tipe</th>
                    <th className="text-left p-4 font-semibold">Nama</th>
                    <th className="text-left p-4 font-semibold">No. WA</th>
                    <th className="text-left p-4 font-semibold">Tanggal</th>
                    <th className="text-right p-4 font-semibold">Total</th>
                    <th className="text-center p-4 font-semibold">Status</th>
                    <th className="text-center p-4 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {booking.id}
                      </td>
                      <td className="p-4">
                        <span className={`badge ${booking.type === 'toko' ? 'badge-amber' : 'badge-blue'}`}>
                          {booking.type === 'toko' ? 'Toko' : 'Wisata'}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-900">
                        {booking.customer_name}
                      </td>
                      <td className="p-4 text-gray-600">{booking.customer_phone}</td>
                      <td className="p-4 text-gray-600">
                        {formatDate(booking.booking_date || booking.created_at)}
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatPrice(booking.total_amount)}
                      </td>
                      <td className="p-4 text-center">
                        {statusBadge(booking.status)}
                      </td>
                      <td className="p-4 text-center">
                        <a
                          href={`https://wa.me/${booking.customer_phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                        >
                          Hubungi
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
