'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { formatDate, formatPrice } from '@/lib/utils'
import { isAccommodationItem } from '@repo/shared-utils'

interface RentalRow {
  id: string
  booking_id: string
  item_id: string
  item_name: string | null
  quantity: number
  booking_date: string
  time_start: string | null
  time_end: string | null
  status: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string } | null
}

interface AccommodationRow {
  id: string
  booking_id: string
  item_name: string
  accommodation_type: string
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
  tent_size: string | null
  tent_count: number | null
  tent_option: string | null
  total_price: number
  status: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string; status: string; document_type: string | null } | null
}

interface DateBlock {
  id: string
  item_id: string
  item_name: string | null
  start_date: string
  end_date: string
  reason: string | null
}

interface StayOption {
  id: string
  name: string
}

interface HolidayDate {
  holiday_date: string
  label: string | null
}

function formatClock(value: string | null) {
  return value ? value.slice(0, 5) : '-'
}

function rangeText(start: string, end: string) {
  return `${formatDate(start)} - ${formatDate(end)}`
}

function badgeClasses(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    returned: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    paid: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

function orderKey(date: string, time: string | null) {
  return `${date}T${time || '00:00'}`
}

export default function AdminJadwalPage() {
  const [tab, setTab] = useState<'rental' | 'accommodation'>('rental')
  const [filterDate, setFilterDate] = useState('')
  const [rentals, setRentals] = useState<RentalRow[]>([])
  const [accommodations, setAccommodations] = useState<AccommodationRow[]>([])
  const [blocks, setBlocks] = useState<DateBlock[]>([])
  const [stayOptions, setStayOptions] = useState<StayOption[]>([])
  const [holidayDates, setHolidayDates] = useState<HolidayDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockForm, setBlockForm] = useState({ itemId: '', startDate: '', endDate: '', reason: '' })
  const [holidayForm, setHolidayForm] = useState({ date: '', label: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    params.set('_refresh', String(refreshKey))
    if (filterDate) {
      params.set('start_date', filterDate)
      params.set('end_date', filterDate)
    }

    try {
      const [rentalsResponse, staysResponse, blocksResponse, packagesResponse, holidaysResponse] = await Promise.all([
        fetch(`/api/admin/rentals?${params}`),
        fetch(`/api/admin/accommodations?${params}`),
        fetch('/api/admin/booking-date-blocks'),
        fetch('/api/tour-packages?available=true'),
        fetch('/api/admin/booking-holiday-dates'),
      ])

      if (![rentalsResponse, staysResponse, blocksResponse, packagesResponse, holidaysResponse].every((response) => response.ok)) {
        throw new Error('Gagal memuat jadwal')
      }

      const [rentalData, stayData, blockData, packageData, holidayData] = await Promise.all([
        rentalsResponse.json(),
        staysResponse.json(),
        blocksResponse.json(),
        packagesResponse.json(),
        holidaysResponse.json(),
      ])

      setRentals(rentalData)
      setAccommodations(stayData)
      setBlocks(blockData)
      setHolidayDates(holidayData)

      const options = packageData.filter((item: StayOption) => isAccommodationItem(item.id))
      setStayOptions(options)
      setBlockForm((current) => ({ ...current, itemId: current.itemId || options[0]?.id || '' }))
    } catch {
      setError('Gagal memuat jadwal. Pastikan migrasi database terbaru sudah dijalankan.')
    } finally {
      setLoading(false)
    }
  }, [filterDate, refreshKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const sortedRentals = useMemo(
    () => [...rentals].sort((a, b) => orderKey(a.booking_date, a.time_start).localeCompare(orderKey(b.booking_date, b.time_start))),
    [rentals],
  )

  const sortedAccommodations = useMemo(
    () => [...accommodations].sort((a, b) => orderKey(a.check_in_date, null).localeCompare(orderKey(b.check_in_date, null))),
    [accommodations],
  )

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [blocks],
  )

  const sortedHolidayDates = useMemo(
    () => [...holidayDates].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
    [holidayDates],
  )

  async function updateRentalStatus(id: string, status: string) {
    const response = await fetch(`/api/admin/rentals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  async function cancelAccommodation(bookingId: string) {
    if (!window.confirm('Batalkan booking ini dan buka kembali tanggalnya?')) return
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  async function createDateBlock(event: FormEvent) {
    event.preventDefault()
    const option = stayOptions.find((item) => item.id === blockForm.itemId)
    const response = await fetch('/api/admin/booking-date-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...blockForm, itemName: option?.name }),
    })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'Gagal menutup tanggal')
      return
    }
    setShowBlockForm(false)
    setBlockForm((current) => ({ ...current, startDate: '', endDate: '', reason: '' }))
    setRefreshKey((value) => value + 1)
  }

  async function removeDateBlock(id: string) {
    const response = await fetch(`/api/admin/booking-date-blocks?id=${id}`, { method: 'DELETE' })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  async function saveHolidayDate(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/admin/booking-holiday-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holidayForm),
    })
    if (response.ok) {
      setHolidayForm({ date: '', label: '' })
      setRefreshKey((value) => value + 1)
    }
  }

  async function removeHolidayDate(date: string) {
    const response = await fetch(`/api/admin/booking-holiday-dates?date=${date}`, { method: 'DELETE' })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  return (
    <div>
      <div className="admin-page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Booking</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hanya booking dengan pembayaran lunas yang tampil sebagai jadwal aktif.
          </p>
        </div>
        {tab === 'accommodation' && (
          <button
            type="button"
            onClick={() => setShowBlockForm((value) => !value)}
            className="btn-primary text-sm"
          >
            {showBlockForm ? 'Tutup form' : '+ Tutup tanggal'}
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm sm:max-w-lg">
        <button
          type="button"
          onClick={() => setTab('rental')}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'rental' ? 'bg-emerald-700 text-white' : 'text-gray-600'}`}
        >
          Sewa Tempat
        </button>
        <button
          type="button"
          onClick={() => setTab('accommodation')}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'accommodation' ? 'bg-emerald-700 text-white' : 'text-gray-600'}`}
        >
          Penginapan & Camping
        </button>
      </div>

      <div className="admin-filterbar mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <label className="form-label">Filter tanggal</label>
          <input
            type="date"
            className="form-input"
            value={filterDate}
            onChange={(event) => setFilterDate(event.target.value)}
          />
        </div>
        {filterDate && (
          <button
            type="button"
            onClick={() => setFilterDate('')}
            className="btn-outline text-sm"
          >
            Reset
          </button>
        )}
      </div>

      {showBlockForm && tab === 'accommodation' && (
        <form onSubmit={createDateBlock} className="mt-4 grid gap-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="form-label">Unit</label>
            <select
              className="form-select"
              value={blockForm.itemId}
              onChange={(event) => setBlockForm({ ...blockForm, itemId: event.target.value })}
            >
              {stayOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Mulai ditutup</label>
            <input
              required
              type="date"
              className="form-input"
              value={blockForm.startDate}
              onChange={(event) => setBlockForm({ ...blockForm, startDate: event.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Dibuka kembali</label>
            <input
              required
              type="date"
              min={blockForm.startDate}
              className="form-input"
              value={blockForm.endDate}
              onChange={(event) => setBlockForm({ ...blockForm, endDate: event.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Alasan</label>
            <input
              className="form-input"
              value={blockForm.reason}
              onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}
              placeholder="Perawatan, acara, dll."
            />
          </div>
          <button className="btn-primary sm:col-span-2 lg:col-span-4">Simpan tanggal tutup</button>
        </form>
      )}

      {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : tab === 'rental' ? (
        <div
          className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
          data-lenis-prevent
          data-scroll-container
        >
          {sortedRentals.length === 0 ? (
            <p className="py-12 text-center text-gray-500">Belum ada jadwal sewa.</p>
          ) : (
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Waktu</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Layanan</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Pemesan</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRentals.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDate(row.booking_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p className="font-medium">
                        {formatClock(row.time_start)}
                        {row.time_end ? ` - ${formatClock(row.time_end)}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{row.quantity} unit</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.item_name || row.item_id}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-400">
                        {row.bookings?.booking_code || row.booking_id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{row.bookings?.customer_name || '-'}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{row.bookings?.customer_phone || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/invoice/${row.booking_id}?phone=${encodeURIComponent(row.bookings?.customer_phone || '')}`}
                          className="text-sm font-medium text-emerald-600 hover:underline"
                        >
                          Invoice
                        </Link>
                        {row.status === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateRentalStatus(row.id, 'returned')}
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              Selesai
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRentalStatus(row.id, 'cancelled')}
                              className="text-sm font-medium text-red-600 hover:underline"
                            >
                              Batal
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div
            className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
            data-lenis-prevent
            data-scroll-container
          >
            {sortedAccommodations.length === 0 ? (
              <p className="py-12 text-center text-gray-500">Belum ada booking penginapan.</p>
            ) : (
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700">Periode</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Unit</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Pemesan</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Detail</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedAccommodations.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">
                        <p className="font-medium">{rangeText(row.check_in_date, row.check_out_date)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{row.nights} malam</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.item_name}</p>
                        <p className="mt-0.5 text-xs text-gray-500 capitalize">{row.accommodation_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{row.bookings?.customer_name || '-'}</p>
                        <p className="mt-0.5 font-mono text-xs text-gray-400">
                          {row.bookings?.booking_code || row.booking_id.slice(0, 8)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">{row.bookings?.customer_phone || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{row.guest_count} tamu</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatPrice(row.total_price)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {row.tent_size ? `Tenda ${row.tent_size}` : 'Tanpa tenda'}
                          {row.tent_count ? ` - ${row.tent_count} unit` : ''}
                          {row.tent_option ? ` - ${row.tent_option}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/invoice/${row.booking_id}?phone=${encodeURIComponent(row.bookings?.customer_phone || '')}`}
                            className="text-sm font-medium text-emerald-600 hover:underline"
                          >
                            Invoice
                          </Link>
                          {row.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => cancelAccommodation(row.booking_id)}
                              className="text-sm font-medium text-red-600 hover:underline"
                            >
                              Batalkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <section className="mt-7 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Tanggal yang ditutup admin</h2>
                <p className="mt-1 text-sm text-gray-500">Daftar tanggal yang sedang ditutup manual oleh pengelola.</p>
              </div>
            </div>

            <div className="admin-table-scroll mt-4 rounded-xl border border-orange-100" data-lenis-prevent data-scroll-container>
              {sortedBlocks.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Tidak ada tanggal yang ditutup manual.</p>
              ) : (
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="border-b bg-orange-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Unit</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Rentang</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Alasan</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {sortedBlocks.map((block) => (
                      <tr key={block.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{block.item_name || block.item_id}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{rangeText(block.start_date, block.end_date)}</td>
                        <td className="px-4 py-3 text-gray-600">{block.reason || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeDateBlock(block.id)}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Buka kembali tanggal
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="mt-7 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Kalender tarif Holiday</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Tanggal di sini otomatis memakai tarif Holiday homestay. Sistem tidak menebak tanggal libur.
                </p>
              </div>
            </div>

            <form onSubmit={saveHolidayDate} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              <input
                required
                type="date"
                className="form-input"
                value={holidayForm.date}
                onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })}
                aria-label="Tanggal libur"
              />
              <input
                className="form-input"
                value={holidayForm.label}
                onChange={(event) => setHolidayForm({ ...holidayForm, label: event.target.value })}
                placeholder="Nama hari libur/acara"
              />
              <button className="btn-primary text-sm">Tambah tanggal</button>
            </form>

            <div className="admin-table-scroll mt-4 rounded-xl border border-orange-100" data-lenis-prevent data-scroll-container>
              {sortedHolidayDates.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">Belum ada tanggal tarif Holiday.</p>
              ) : (
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="border-b bg-orange-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Label</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {sortedHolidayDates.map((holiday) => (
                      <tr key={holiday.holiday_date} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{formatDate(holiday.holiday_date)}</td>
                        <td className="px-4 py-3 text-gray-600">{holiday.label || 'Holiday'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => removeHolidayDate(holiday.holiday_date)}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
