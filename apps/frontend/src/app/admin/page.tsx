'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'

interface BookingRow {
  id: string
  booking_code: string
  type: string
  customer_name: string
  customer_phone: string
  booking_date: string
  total_amount: number
  status: string
  payment_status: string
  created_at: string
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (paymentFilter) params.set('payment_status', paymentFilter)
      const res = await fetch(`/api/bookings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBookings(data)
      } else {
        setError('Gagal memuat data booking')
      }
    } catch (e) {
      console.error(e)
      setError('Gagal memuat data booking')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, paymentFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  const totalBookings = bookings.length
  const totalWisata = bookings.filter((b) => b.type === 'wisata').length
  const totalToko = bookings.filter((b) => b.type === 'toko').length
  const totalPaid = bookings.filter((b) => b.payment_status === 'paid').length
  const totalRevenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + b.total_amount, 0)

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      confirmed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const paymentBadge = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      refunded: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Ringkasan booking dan pendapatan</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Booking</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalBookings}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Wisata</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{totalWisata}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Toko</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{totalToko}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Lunas</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{totalPaid}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pendapatan</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatPrice(totalRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filterbar mt-6 flex flex-wrap gap-3">
        <select
          className="form-input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status"
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          className="form-input w-auto"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          aria-label="Filter pembayaran"
        >
          <option value="">Semua Pembayaran</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
        data-lenis-prevent
        data-scroll-container
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Belum ada booking</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Kode</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tipe</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Pembayaran</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.slice(0, 50).map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                    {b.booking_code || b.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{b.type}</td>
                  <td className="px-4 py-3 text-gray-900">{b.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.booking_date
                      ? new Date(b.booking_date).toLocaleDateString('id-ID')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatPrice(b.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(b.status)}`}
                      aria-label={b.status}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge(b.payment_status)}`}
                      aria-label={b.payment_status}
                    >
                      {b.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoice/${b.id}?phone=${encodeURIComponent(b.customer_phone)}`}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
