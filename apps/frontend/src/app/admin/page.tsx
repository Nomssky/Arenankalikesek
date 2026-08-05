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
  booking_date: string
  total_amount: number
  status: string
  payment_status: string
  created_at: string
}

interface RentalScheduleRow {
  id: string
  booking_id: string
  item_name: string | null
  booking_date: string
  time_start: string | null
  time_end: string | null
  status: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string } | null
}

interface AccommodationScheduleRow {
  id: string
  booking_id: string
  item_name: string
  accommodation_type: string
  check_in_date: string
  check_out_date: string
  status: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string } | null
}

interface DashboardScheduleRow {
  id: string
  bookingId: string
  bookingCode: string
  kind: 'Aktivitas / Sewa' | 'Penginapan / Camping' | 'Eduwisata / Kegiatan'
  itemName: string
  customerName: string
  customerPhone: string
  startDate: string
  endDate?: string
  timeStart?: string | null
  timeEnd?: string | null
  status: string
}

interface EduTripRow {
  id: string
  booking_code: string | null
  customer_name: string | null
  customer_phone: string | null
  booking_date: string
  booking_mode: string
  status: string
  items: { name?: string | null }[] | null
}

export default function AdminDashboardPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [schedules, setSchedules] = useState<DashboardScheduleRow[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState('')
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (paymentFilter) params.set('payment_status', paymentFilter)
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
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
  }, [statusFilter, paymentFilter, startDate, endDate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  useEffect(() => {
    let active = true

    async function fetchSchedules() {
      setScheduleLoading(true)
      setScheduleError('')
      try {
        const [year, month] = scheduleMonth.split('-').map(Number)
        const daysInMonth = new Date(year, month, 0).getDate()
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate })

        const [rentalResponse, accommodationResponse, edutripResponse] = await Promise.all([
          fetch(`/api/admin/rentals?${params}`, { cache: 'no-store' }),
          fetch(`/api/admin/accommodations?${params}`, { cache: 'no-store' }),
          fetch(`/api/bookings?${params}`, { cache: 'no-store' }),
        ])

        if (!rentalResponse.ok || !accommodationResponse.ok || !edutripResponse.ok) {
          throw new Error('Gagal memuat jadwal')
        }

        const [rentals, accommodations, bookings] = (await Promise.all([
          rentalResponse.json(),
          accommodationResponse.json(),
          edutripResponse.json(),
        ])) as [RentalScheduleRow[], AccommodationScheduleRow[], EduTripRow[]]

        const eduTrips = bookings.filter(
          (b) => b.booking_mode === 'edu_trip'
            && b.booking_date >= startDate
            && b.booking_date <= endDate
            && b.status !== 'cancelled',
        )

        const combined: DashboardScheduleRow[] = [
          ...rentals.map((row) => ({
            id: `rental-${row.id}`,
            bookingId: row.booking_id,
            bookingCode: row.bookings?.booking_code || row.booking_id.slice(0, 8),
            kind: 'Aktivitas / Sewa' as const,
            itemName: row.item_name || 'Jadwal aktivitas',
            customerName: row.bookings?.customer_name || '-',
            customerPhone: row.bookings?.customer_phone || '',
            startDate: row.booking_date,
            timeStart: row.time_start,
            timeEnd: row.time_end,
            status: row.status,
          })),
          ...accommodations.map((row) => ({
            id: `accommodation-${row.id}`,
            bookingId: row.booking_id,
            bookingCode: row.bookings?.booking_code || row.booking_id.slice(0, 8),
            kind: 'Penginapan / Camping' as const,
            itemName: row.item_name,
            customerName: row.bookings?.customer_name || '-',
            customerPhone: row.bookings?.customer_phone || '',
            startDate: row.check_in_date,
            endDate: row.check_out_date,
            status: row.status,
          })),
          ...eduTrips.map((row) => ({
            id: `edutrip-${row.id}`,
            bookingId: row.id,
            bookingCode: row.booking_code || row.id.slice(0, 8),
            kind: 'Eduwisata / Kegiatan' as const,
            itemName: (Array.isArray(row.items) && row.items[0]?.name) || 'Paket Eduwisata',
            customerName: row.customer_name || '-',
            customerPhone: row.customer_phone || '',
            startDate: row.booking_date,
            status: row.status,
          })),
        ]

        combined.sort((a, b) => {
          const first = `${a.startDate}T${a.timeStart?.slice(0, 5) || '00:00'}`
          const second = `${b.startDate}T${b.timeStart?.slice(0, 5) || '00:00'}`
          return second.localeCompare(first)
        })

        if (active) setSchedules(combined)
      } catch {
        if (active) setScheduleError('Gagal memuat semua jadwal')
      } finally {
        if (active) setScheduleLoading(false)
      }
    }

    fetchSchedules()
    return () => {
      active = false
    }
  }, [scheduleMonth])

  const totalBookings = bookings.length
  const totalWisata = bookings.filter((b) => b.type === 'wisata').length
  const totalToko = bookings.filter((b) => b.type === 'toko').length
  const totalPaid = bookings.filter((b) => b.payment_status === 'paid').length
  const totalRevenue = bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + b.total_amount, 0)

  const pageStart = page * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const paginatedBookings = bookings.slice(pageStart, pageEnd)
  const maxPage = Math.ceil(bookings.length / PAGE_SIZE)

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      confirmed: 'bg-blue-100 text-blue-800',
      active: 'bg-blue-100 text-blue-800',
      returned: 'bg-emerald-100 text-emerald-800',
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

      <section className="mt-6" aria-labelledby="all-schedules-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="all-schedules-title" className="text-xl font-bold text-gray-900">
              Semua Jadwal
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Seluruh jadwal aktivitas, sewa tempat, penginapan, dan camping.
            </p>
          </div>
          <Link href="/admin/jadwal" className="text-sm font-semibold text-emerald-700 hover:underline">
            Kelola jadwal
          </Link>
        </div>

        <div className="admin-filterbar mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:max-w-xs">
            <label className="form-label">Filter bulan</label>
            <input
              type="month"
              className="form-input"
              value={scheduleMonth}
              onChange={(e) => setScheduleMonth(e.target.value)}
            />
          </div>
          <p className="text-sm text-gray-500">
            Menampilkan jadwal untuk <span className="font-medium text-gray-700">{new Date(`${scheduleMonth}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          </p>
        </div>

        <div
          className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
          data-lenis-prevent
          data-scroll-container
        >
          {scheduleLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
            </div>
          ) : scheduleError ? (
            <div className="p-6 text-center text-sm text-red-700">{scheduleError}</div>
          ) : schedules.length === 0 ? (
            <p className="py-12 text-center text-gray-500">Belum ada jadwal booking</p>
          ) : (
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Jenis</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Jadwal</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Pemesan</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {schedule.endDate
                        ? `${formatDate(schedule.startDate)} – ${formatDate(schedule.endDate)}`
                        : formatDate(schedule.startDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{schedule.kind}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{schedule.itemName}</p>
                      {schedule.timeStart && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {schedule.timeStart.slice(0, 5)}
                          {schedule.timeEnd ? `–${schedule.timeEnd.slice(0, 5)}` : ''} WIB
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{schedule.customerName}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">{schedule.bookingCode}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(schedule.status)}`}
                      >
                        {schedule.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoice/${schedule.bookingId}?phone=${encodeURIComponent(schedule.customerPhone)}`}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900">Data Booking</h2>
        <p className="mt-1 text-sm text-gray-500">Daftar transaksi dan status pembayaran.</p>
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
              {paginatedBookings.map((b) => (
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
                      href={`/invoice/${b.id}?phone=${encodeURIComponent(b.customer_phone || '')}`}
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
        {bookings.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t p-4 text-sm">
            <p className="text-gray-600">
              Menampilkan {pageStart + 1}–{Math.min(pageEnd, bookings.length)} dari {bookings.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(maxPage - 1, p + 1))}
                disabled={page >= maxPage - 1}
                className="btn-secondary disabled:opacity-50"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
