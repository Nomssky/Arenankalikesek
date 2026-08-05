'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatPrice } from '@/lib/utils'

interface BookingRow {
  id: string
  booking_code: string
  type: string
  customer_name: string
  customer_phone: string
  customer_email: string
  booking_date: string
  time_start: string
  total_amount: number
  status: string
  payment_status: string
  payment_method: string
  items: { id?: string; name: string; quantity?: number }[]
  created_at: string
}

function csvCell(value: string | number): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function itemsText(items: { name: string; quantity?: number }[] | undefined) {
  return (items || []).map((item) => `${item.name}${item.quantity && item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join('; ')
}

export default function AdminReportPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      if (typeFilter) params.set('type', typeFilter)
      if (paymentFilter) params.set('payment_status', paymentFilter)
      const res = await fetch(`/api/bookings?${params}`)
      if (!res.ok) throw new Error('Gagal memuat data')
      setBookings(await res.json())
    } catch (e) {
      console.error(e)
      setError('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, typeFilter, paymentFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  const paid = bookings.filter((b) => b.payment_status === 'paid')
  const refunded = bookings.filter((b) => b.payment_status === 'refunded')
  const cancelled = bookings.filter((b) => b.status === 'cancelled')
  const totalPaid = paid.reduce((sum, b) => sum + b.total_amount, 0)
  const totalRefunded = refunded.reduce((sum, b) => sum + b.total_amount, 0)

  function exportCsv() {
    const header = ['Kode', 'Tanggal Booking', 'Tipe', 'Nama', 'No WA', 'Email', 'Item', 'Total', 'Status', 'Pembayaran', 'Metode', 'Dibuat']
    const rows = bookings.map((b) => [
      b.booking_code || b.id,
      b.booking_date || '',
      b.type,
      b.customer_name,
      b.customer_phone,
      b.customer_email,
      itemsText(b.items),
      b.total_amount,
      b.status,
      b.payment_status,
      b.payment_method || '',
      b.created_at ? new Date(b.created_at).toLocaleString('id-ID') : '',
    ])
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `laporan-pemasukan-${startDate || 'semua'}-${endDate || ''}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="text-2xl font-bold text-gray-900">Laporan Pemasukan</h1>
        <p className="mt-1 text-sm text-gray-500">Rekap transaksi dan pendapatan. Angka bersumber dari data booking (server).</p>
      </div>

      <div className="admin-filterbar mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-gray-700">
          Dari
          <input type="date" className="form-input mt-1 block w-auto" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Sampai
          <input type="date" className="form-input mt-1 block w-auto" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <select className="form-input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter tipe">
          <option value="">Semua Tipe</option>
          <option value="wisata">Wisata</option>
          <option value="sewa">Sewa</option>
          <option value="toko">Toko</option>
          <option value="parkir">Parkir</option>
        </select>
        <select className="form-input w-auto" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filter pembayaran">
          <option value="">Semua Pembayaran</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <button type="button" onClick={exportCsv} disabled={!bookings.length} className="btn-primary disabled:opacity-50">
          Unduh CSV
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="mt-6 grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Transaksi</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{bookings.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Lunas</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{paid.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Refunded</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{refunded.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Dibatalkan</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{cancelled.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pendapatan Bersih</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatPrice(totalPaid - totalRefunded)}</p>
        </div>
      </div>

      <div className="admin-table-scroll admin-table-scroll--wide mt-6 rounded-xl bg-white shadow-sm" data-lenis-prevent data-scroll-container>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Tidak ada data untuk filter ini</p>
        ) : (
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Kode</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Item</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Pembayaran</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{b.booking_code || b.id.slice(0, 8)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {b.booking_date ? formatDate(b.booking_date) : '-'}
                    {b.time_start ? ` · ${b.time_start.slice(0, 5)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{b.customer_name}</td>
                  <td className="max-w-64 px-4 py-3 text-gray-600">{itemsText(b.items)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(b.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-gray-700">{b.payment_status}</span>
                    {b.payment_method && <span className="mt-0.5 block text-xs text-gray-400">{b.payment_method}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/invoice/${b.id}?phone=${encodeURIComponent(b.customer_phone || '')}`} className="text-sm font-medium text-emerald-600 hover:underline">
                      Invoice
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