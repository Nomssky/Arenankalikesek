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
  customer_email: string
  customer_address: string
  event_name: string
  booking_date: string
  time_start: string
  time_end: string
  total_amount: number
  status: string
  payment_status: string
  payment_method: string
  payment_url: string
  assigned_pic: string
  notes: string
  created_at: string
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{ status: string; payment_status: string } | null>(null)
  const [savedData, setSavedData] = useState<Record<string, { status: string; payment_status: string }>>({})
  const [error, setError] = useState('')
  const [updateError, setUpdateError] = useState('')

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (paymentFilter) params.set('payment_status', paymentFilter)
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/bookings?${params}`)
      if (res.ok) {
        let data = await res.json()
        if (search) {
          const q = search.toLowerCase()
          data = data.filter(
            (b: BookingRow) =>
              b.customer_name.toLowerCase().includes(q) ||
              b.customer_phone.includes(q) ||
              (b.booking_code && b.booking_code.toLowerCase().includes(q))
          )
        }
        setBookings(data)
      } else {
        setError('Gagal memuat booking')
      }
    } catch (e) {
      console.error(e)
      setError('Gagal memuat booking')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, paymentFilter, typeFilter, search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  function startEdit(b: BookingRow) {
    setSavedData((prev) => ({ ...prev, [b.id]: { status: b.status, payment_status: b.payment_status } }))
    setEditData({ status: b.status, payment_status: b.payment_status })
    setEditingId(b.id)
    setUpdateError('')
  }

  function cancelEdit(id: string) {
    const original = savedData[id]
    if (original) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...original } : b)))
    }
    setEditingId(null)
    setEditData(null)
    setUpdateError('')
  }

  async function saveEdit(id: string) {
    if (!editData) return
    setUpdateError('')
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ...editData } : b))
        )
        setEditingId(null)
        setEditData(null)
      } else {
        const data = await res.json()
        setUpdateError(data.error || 'Gagal mengupdate booking')
      }
    } catch (e) {
      console.error(e)
      setUpdateError('Gagal mengupdate booking')
    }
  }

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
      <div className="admin-page-header flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Booking</h1>
        <span className="text-sm text-gray-500">{bookings.length} booking</span>
      </div>

      <div className="admin-filterbar mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Cari nama/no. WA/kode..."
          className="form-input flex-1 min-w-[200px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchBookings()}
        />
        <select
          className="form-input w-auto"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter tipe"
        >
          <option value="">Semua Tipe</option>
          <option value="wisata">Wisata</option>
          <option value="toko">Toko</option>
          <option value="parkir">Parkir</option>
          <option value="sewa">Sewa</option>
        </select>
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

      <div
        className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
        data-lenis-prevent
        data-scroll-container
      >
        {updateError && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {updateError}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Tidak ada booking</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Kode</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tipe</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">No. WA</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Bayar</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                    {b.booking_code || b.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{b.type}</td>
                  <td className="px-4 py-3 text-gray-900">{b.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <a
                      href={`https://wa.me/${b.customer_phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      className="text-emerald-600 hover:underline"
                    >
                      {b.customer_phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.booking_date
                      ? new Date(b.booking_date).toLocaleDateString('id-ID')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatPrice(b.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === b.id ? (
                      <select
                        className="form-input text-xs py-1"
                        value={editData?.status || b.status}
                        onChange={(e) =>
                          setEditData((prev) => prev ? { ...prev, status: e.target.value } : null)
                        }
                        autoFocus
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => startEdit(b)}
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(b.status)}`}
                        aria-label={b.status}
                      >
                        {b.status}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === b.id ? (
                      <select
                        className="form-input text-xs py-1"
                        value={editData?.payment_status || b.payment_status}
                        onChange={(e) =>
                          setEditData((prev) => prev ? { ...prev, payment_status: e.target.value } : null)
                        }
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => startEdit(b)}
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge(b.payment_status)}`}
                        aria-label={b.payment_status}
                      >
                        {b.payment_status}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === b.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(b.id)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => cancelEdit(b.id)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                    <div className="flex gap-2">
                      <Link
                        href={`/invoice/${b.id}`}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Invoice
                      </Link>
                      <a
                        href={`https://wa.me/${b.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${b.customer_name}, booking ${b.booking_code || ''} di Arenan Kalikesek.`)}`}
                        target="_blank"
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        WA
                      </a>
                    </div>
                    )}
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
