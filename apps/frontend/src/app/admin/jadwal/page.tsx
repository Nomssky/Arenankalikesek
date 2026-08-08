'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { formatDate, formatPrice } from '@/lib/utils'
import { accommodationTypeForItem, isAccommodationItem, stayDateKeys } from '@repo/shared-utils'
import MonthFilter from '@/components/admin/MonthFilter'

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
  item_id: string
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

interface EduTripBooking {
  id: string
  booking_code: string | null
  customer_name: string | null
  customer_phone: string | null
  booking_date: string
  booking_mode: string
  status: string
  payment_status: string
  guest_count: number | null
  notes: string | null
  items: { name?: string | null }[] | null
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

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function weekdayLabel(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' })
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

function getMonthBounds(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!year || !month || month < 1 || month > 12) {
    return null
  }

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

  return {
    year,
    month,
    daysInMonth: end.getDate(),
    startDate: `${year}-${pad2(month)}-01`,
    endDate: `${year}-${pad2(month)}-${pad2(end.getDate())}`,
    label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(start),
  }
}

function minutesFromClock(value: string | null) {
  if (!value) return null
  const [hour, minute] = value.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

function slotRangeLabel(hour: number) {
  return `${pad2(hour)}:00 - ${pad2(hour + 1)}:00`
}

function rentalOverlapsSlot(row: RentalRow, date: string, hour: number) {
  if (row.booking_date !== date) return false

  const start = minutesFromClock(row.time_start)
  if (start === null) return false

  const end = minutesFromClock(row.time_end) ?? start + 60
  const slotStart = hour * 60
  const slotEnd = (hour + 1) * 60

  return start < slotEnd && end > slotStart
}

function prettyAccommodationType(value: string | null) {
  const mapped: Record<string, string> = {
    homestay: 'Homestay',
    camping: 'Camping',
    glamping: 'Glamping',
  }
  if (!value) return '-'
  return mapped[value] || value
}

function cellBadgeClasses(used: number, full: boolean) {
  if (full) return 'bg-red-700 text-white ring-1 ring-red-800'
  if (used > 0) return 'bg-amber-500 text-amber-950 ring-1 ring-amber-700'
  return 'bg-white text-gray-400 ring-1 ring-gray-200'
}

function eduPackageName(booking: EduTripBooking) {
  const first = Array.isArray(booking.items) ? booking.items[0] : null
  return first?.name || '-'
}

function eduParticipantCount(booking: EduTripBooking) {
  if (booking.guest_count) return `${booking.guest_count} orang`
  const match = String(booking.notes || '').match(/Jumlah peserta:\s*(\d+)\s*orang/)
  return match ? `${match[1]} orang` : '-'
}

function orderKey(date: string, time: string | null) {
  return `${date}T${time || '00:00'}`
}

export default function AdminJadwalPage() {
  const [tab, setTab] = useState<'rental' | 'accommodation' | 'edutrip'>('rental')
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())
  const [rentals, setRentals] = useState<RentalRow[]>([])
  const [accommodations, setAccommodations] = useState<AccommodationRow[]>([])
  const [blocks, setBlocks] = useState<DateBlock[]>([])
  const [stayOptions, setStayOptions] = useState<StayOption[]>([])
  const [holidayDates, setHolidayDates] = useState<HolidayDate[]>([])
  const [eduTrips, setEduTrips] = useState<EduTripBooking[]>([])
  const [eduQuota, setEduQuota] = useState(2)
  const [selectedEduDate, setSelectedEduDate] = useState<string | null>(null)
  const [eduUsedByDate, setEduUsedByDate] = useState<Record<string, number>>({})
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
    const monthBounds = getMonthBounds(selectedMonth)
    if (monthBounds) {
      params.set('start_date', monthBounds.startDate)
      params.set('end_date', monthBounds.endDate)
    }

    try {
      const [rentalsResponse, staysResponse, blocksResponse, packagesResponse, holidaysResponse, eduTripsResponse, eduAvailabilityResponse] = await Promise.all([
        fetch(`/api/admin/rentals?${params}`),
        fetch(`/api/admin/accommodations?${params}`),
        fetch('/api/admin/booking-date-blocks'),
        fetch('/api/tour-packages?available=true'),
        fetch('/api/admin/booking-holiday-dates'),
        fetch(`/api/admin/edu-trips?${params}`),
        fetch(`/api/edu-trip-availability?month=${selectedMonth}`),
      ])

      if (![rentalsResponse, staysResponse, blocksResponse, packagesResponse, holidaysResponse, eduTripsResponse, eduAvailabilityResponse].every((response) => response.ok)) {
        throw new Error('Gagal memuat jadwal')
      }

      const [rentalData, stayData, blockData, packageData, holidayData, eduTripsData, eduAvailabilityData] = await Promise.all([
        rentalsResponse.json(),
        staysResponse.json(),
        blocksResponse.json(),
        packagesResponse.json(),
        holidaysResponse.json(),
        eduTripsResponse.json(),
        eduAvailabilityResponse.json(),
      ])

      setRentals(rentalData)
      setAccommodations(stayData)
      setBlocks(blockData)
      setHolidayDates(holidayData)
      setEduTrips((eduTripsData || []).filter(
        (item: EduTripBooking) => item.status !== 'cancelled',
      ))
      setEduQuota(Number(eduAvailabilityData.quota) || 2)
      setEduUsedByDate(eduAvailabilityData.byDate || {})

      const options = packageData.filter((item: StayOption) => isAccommodationItem(item.id))
      setStayOptions(options)
      setBlockForm((current) => ({ ...current, itemId: current.itemId || options[0]?.id || '' }))
    } catch {
      setError('Gagal memuat jadwal. Pastikan migrasi database terbaru sudah dijalankan.')
    } finally {
      setLoading(false)
    }
  }, [refreshKey, selectedMonth])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  const sortedRentals = useMemo(
    () => [...rentals].sort((a, b) => orderKey(b.booking_date, b.time_start).localeCompare(orderKey(a.booking_date, a.time_start))),
    [rentals],
  )

  const sortedAccommodations = useMemo(
    () => [...accommodations].sort((a, b) => orderKey(b.check_in_date, null).localeCompare(orderKey(a.check_in_date, null))),
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

  const monthBounds = useMemo(() => getMonthBounds(selectedMonth) || getMonthBounds(currentMonthKey()), [selectedMonth])
  const eduMondayOffset = useMemo(() => {
    if (!monthBounds) return 0
    return (new Date(monthBounds.year, monthBounds.month - 1, 1).getDay() + 6) % 7
  }, [monthBounds])
  const rentalDayColumns = useMemo(() => {
    if (!monthBounds) return []
    return Array.from({ length: monthBounds.daysInMonth }, (_, index) => index + 1)
  }, [monthBounds])

  const rentalHourRows = useMemo(() => Array.from({ length: 10 }, (_, index) => 7 + index), [])

  const rentalRowsByDate = useMemo(() => {
    const map = new Map<string, RentalRow[]>()
    for (const row of sortedRentals) {
      const list = map.get(row.booking_date) || []
      list.push(row)
      map.set(row.booking_date, list)
    }
    return map
  }, [sortedRentals])

  const monthLabel = monthBounds?.label || 'Bulan ini'

  const monthDateColumns = useMemo(() => {
    if (!monthBounds) return []
    return Array.from({ length: monthBounds.daysInMonth }, (_, index) => {
      const day = index + 1
      return {
        day,
        dateKey: `${monthBounds.year}-${pad2(monthBounds.month)}-${pad2(day)}`,
      }
    })
  }, [monthBounds])

  const sortedEduTrips = useMemo(
    () => [...eduTrips].sort((a, b) => b.booking_date.localeCompare(a.booking_date)),
    [eduTrips],
  )

  const eduTripsByDate = useMemo(() => {
    const map = new Map<string, EduTripBooking[]>()
    for (const booking of eduTrips) {
      const list = map.get(booking.booking_date) || []
      list.push(booking)
      map.set(booking.booking_date, list)
    }
    return map
  }, [eduTrips])

  const visibleEduTrips = useMemo(
    () => (selectedEduDate ? (eduTripsByDate.get(selectedEduDate) || []) : sortedEduTrips),
    [selectedEduDate, eduTripsByDate, sortedEduTrips],
  )

  const eduDays = useMemo(
    () => monthDateColumns.map(({ day, dateKey }) => {
      const used = eduUsedByDate[dateKey] || 0
      const bookings = eduTripsByDate.get(dateKey) || []
      return { day, dateKey, used, remaining: Math.max(0, eduQuota - used), bookings }
    }),
    [monthDateColumns, eduUsedByDate, eduQuota, eduTripsByDate],
  )

  const eduSummary = useMemo(() => {
    let totalRombongan = 0
    let fullDays = 0
    for (const day of eduDays) {
      totalRombongan += day.used
      if (day.remaining <= 0) fullDays += 1
    }
    return { totalRombongan, fullDays }
  }, [eduDays])

  const accommodationUnits = useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: string | null }>()

    for (const option of stayOptions) {
      map.set(option.id, {
        id: option.id,
        name: option.name,
        type: accommodationTypeForItem(option.id),
      })
    }

    for (const booking of sortedAccommodations) {
      if (!map.has(booking.item_id)) {
        map.set(booking.item_id, {
          id: booking.item_id,
          name: booking.item_name || booking.item_id,
          type: booking.accommodation_type || accommodationTypeForItem(booking.item_id),
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [sortedAccommodations, stayOptions])

  const accommodationBookingsByUnit = useMemo(() => {
    const map = new Map<string, AccommodationRow[]>()
    for (const booking of sortedAccommodations) {
      const list = map.get(booking.item_id) || []
      list.push(booking)
      map.set(booking.item_id, list)
    }
    return map
  }, [sortedAccommodations])

  const accommodationTimelineByUnit = useMemo(() => {
    const map = new Map<
      string,
      Array<
        | {
            kind: 'empty'
            key: string
            span: number
          }
        | {
            kind: 'booking'
            key: string
            span: number
            booking: AccommodationRow
            visibleDates: string[]
            startsBeforeMonth: boolean
            endsAfterMonth: boolean
          }
      >
    >()

    if (!monthBounds) return map

    for (const unit of accommodationUnits) {
      const unitBookings = [...(accommodationBookingsByUnit.get(unit.id) || [])].sort((a, b) =>
        a.check_in_date.localeCompare(b.check_in_date),
      )

      const bookingStarts = new Map<
        string,
        {
          booking: AccommodationRow
          visibleDates: string[]
          startsBeforeMonth: boolean
          endsAfterMonth: boolean
        }
      >()

      for (const booking of unitBookings) {
        const visibleDates = stayDateKeys(booking.check_in_date, booking.check_out_date).filter(
          (date) => date >= monthBounds.startDate && date <= monthBounds.endDate,
        )
        if (visibleDates.length === 0) continue

        bookingStarts.set(visibleDates[0], {
          booking,
          visibleDates,
          startsBeforeMonth: booking.check_in_date < monthBounds.startDate,
          endsAfterMonth: booking.check_out_date > monthBounds.endDate,
        })
      }

      const cells: Array<
        | {
            kind: 'empty'
            key: string
            span: number
          }
        | {
            kind: 'booking'
            key: string
            span: number
            booking: AccommodationRow
            visibleDates: string[]
            startsBeforeMonth: boolean
            endsAfterMonth: boolean
          }
      > = []

      let dayIndex = 0
      while (dayIndex < monthDateColumns.length) {
        const { dateKey } = monthDateColumns[dayIndex]
        const bookingStart = bookingStarts.get(dateKey)

        if (bookingStart) {
          const span = bookingStart.visibleDates.length
          cells.push({
            kind: 'booking',
            key: `${bookingStart.booking.id}-${dateKey}`,
            span,
            booking: bookingStart.booking,
            visibleDates: bookingStart.visibleDates,
            startsBeforeMonth: bookingStart.startsBeforeMonth,
            endsAfterMonth: bookingStart.endsAfterMonth,
          })
          dayIndex += span
          continue
        }

        cells.push({
          kind: 'empty',
          key: dateKey,
          span: 1,
        })
        dayIndex += 1
      }

      map.set(unit.id, cells)
    }

    return map
  }, [accommodationBookingsByUnit, accommodationUnits, monthBounds, monthDateColumns])

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

      <div className="mt-5 grid grid-cols-3 rounded-xl bg-white p-1 shadow-sm sm:max-w-2xl">
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
        <button
          type="button"
          onClick={() => setTab('edutrip')}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'edutrip' ? 'bg-emerald-700 text-white' : 'text-gray-600'}`}
        >
          Eduwisata dan Kegiatan
        </button>
      </div>

      <div className="admin-filterbar mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
            <label className="form-label">Filter bulan</label>
            <MonthFilter value={selectedMonth} onChange={setSelectedMonth} />
        </div>
        <div className="text-sm text-gray-500">
          Menampilkan jadwal sewa untuk <span className="font-medium text-gray-700">{monthLabel}</span>.
        </div>
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
            <p className="py-12 text-center text-gray-500">Belum ada jadwal sewa pada bulan ini.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1800px] w-full border-separate border-spacing-0 text-left text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                      Jam
                    </th>
                    {rentalDayColumns.map((day) => {
                      const dateKey = `${monthBounds?.year}-${pad2(monthBounds?.month || 1)}-${pad2(day)}`
                      return (
                        <th
                          key={dateKey}
                          className="sticky top-0 z-20 min-w-[150px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-center text-sm font-semibold text-gray-700"
                        >
                          <div>{day}</div>
                          <div className="mt-0.5 text-[10px] font-normal text-gray-500">
                            {formatDate(dateKey)}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rentalHourRows.map((hour) => (
                    <tr key={hour}>
                      <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-4 py-3 align-top text-sm font-semibold text-gray-700">
                        <div>{slotRangeLabel(hour)}</div>
                      </th>
                      {rentalDayColumns.map((day) => {
                        const dateKey = `${monthBounds?.year}-${pad2(monthBounds?.month || 1)}-${pad2(day)}`
                        const dayBookings = (rentalRowsByDate.get(dateKey) || [])
                          .filter((row) => rentalOverlapsSlot(row, dateKey, hour))
                          .sort((a, b) => (a.time_start || '').localeCompare(b.time_start || ''))

                        return (
                          <td
                            key={`${dateKey}-${hour}`}
                            className="min-w-[150px] border-b border-r border-gray-200 bg-white px-2 py-2 align-top"
                          >
                            {dayBookings.length === 0 ? (
                              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-gray-100 text-[10px] text-gray-300">
                                -
                              </div>
                            ) : (
                              <div className="flex max-h-24 flex-col gap-1 overflow-auto pr-1">
                                {dayBookings.map((row) => (
                                  <div
                                    key={`${row.id}-${hour}`}
                                    className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 shadow-sm"
                                  >
                                    <p className="line-clamp-2 font-semibold text-emerald-900">
                                      {row.item_name || row.item_id}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-emerald-700">
                                      {formatClock(row.time_start)}
                                      {row.time_end ? ` - ${formatClock(row.time_end)}` : ''} · {row.quantity} unit
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-gray-600">
                                      {row.bookings?.customer_name || '-'}
                                    </p>
                                    <Link
                                      href={`/invoice/${row.booking_id}?phone=${encodeURIComponent(row.bookings?.customer_phone || '')}`}
                                      className="mt-0.5 inline-flex text-[10px] font-semibold text-emerald-700 hover:underline"
                                    >
                                      Invoice
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'accommodation' ? (
        <>
          <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Yang tampil hanya booking dengan status lunas/confirmed. Saat tidak ada booking pada bulan ini, semua sel menampilkan kosong.
          </p>
          <div
            className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
            data-lenis-prevent
            data-scroll-container
          >
            {accommodationUnits.length === 0 ? (
              <p className="py-12 text-center text-gray-500">Belum ada unit penginapan yang terdaftar.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-[1800px] w-full border-separate border-spacing-0 text-left text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">
                        Unit
                      </th>
                      {monthDateColumns.map(({ day, dateKey }) => (
                        <th
                          key={dateKey}
                          className="sticky top-0 z-20 min-w-[140px] border-b border-r border-gray-200 bg-gray-50 px-2 py-3 text-center text-sm font-semibold text-gray-700"
                        >
                          <div>{day}</div>
                          <div className="mt-0.5 text-[10px] font-normal text-gray-500">
                            {formatDate(dateKey)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accommodationUnits.map((unit) => {
                      const timeline = accommodationTimelineByUnit.get(unit.id) || []

                      return (
                        <tr key={unit.id}>
                          <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-4 py-3 align-top text-left text-sm font-semibold text-gray-700">
                            <div className="flex flex-col gap-1">
                              <span>{unit.name}</span>
                              <span className="text-[10px] font-normal uppercase tracking-wide text-gray-500">
                                {prettyAccommodationType(unit.type)}
                              </span>
                            </div>
                          </th>

                          {timeline.map((cell) => {
                            if (cell.kind === 'empty') {
                              return (
                                <td
                                  key={cell.key}
                                  className="min-w-[140px] border-b border-r border-gray-200 bg-white px-2 py-2 align-top"
                                >
                                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-gray-100 text-[10px] text-gray-300">
                                    -
                                  </div>
                                </td>
                              )
                            }

                            return (
                              <td
                                key={cell.key}
                                colSpan={cell.span}
                                className="border-b border-r border-gray-200 bg-white px-2 py-2 align-top"
                              >
                                <div className="min-h-28 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 shadow-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-emerald-900">
                                        {cell.booking.bookings?.customer_name || cell.booking.item_name}
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-emerald-700">
                                        {rangeText(cell.booking.check_in_date, cell.booking.check_out_date)} · {cell.booking.nights} malam
                                      </p>
                                    </div>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClasses(cell.booking.status)}`}
                                    >
                                      {cell.booking.status}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-[10px] text-gray-600">
                                    {cell.booking.bookings?.booking_code || cell.booking.booking_id.slice(0, 8)}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-gray-600">
                                    {cell.booking.guest_count} tamu · {formatPrice(cell.booking.total_price)}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-gray-600">
                                    {cell.booking.tent_size ? `Tenda ${cell.booking.tent_size}` : 'Tanpa tenda'}
                                    {cell.booking.tent_count ? ` - ${cell.booking.tent_count} unit` : ''}
                                    {cell.booking.tent_option ? ` - ${cell.booking.tent_option}` : ''}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-gray-500">
                                    {cell.booking.bookings?.customer_phone || '-'}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Link
                                      href={`/invoice/${cell.booking.booking_id}?phone=${encodeURIComponent(cell.booking.bookings?.customer_phone || '')}`}
                                      className="text-[10px] font-semibold text-emerald-700 hover:underline"
                                    >
                                      Invoice
                                    </Link>
                                    {cell.booking.status === 'active' && (
                                      <button
                                        type="button"
                                        onClick={() => cancelAccommodation(cell.booking.booking_id)}
                                        className="text-[10px] font-semibold text-red-600 hover:underline"
                                      >
                                        Batalkan
                                      </button>
                                    )}
                                  </div>

                                  {(cell.startsBeforeMonth || cell.endsAfterMonth) && (
                                    <p className="mt-2 text-[10px] text-amber-700">
                                      {cell.startsBeforeMonth ? 'Lanjutan dari bulan sebelumnya' : ''}
                                      {cell.startsBeforeMonth && cell.endsAfterMonth ? ' • ' : ''}
                                      {cell.endsAfterMonth ? 'Berlanjut ke bulan berikutnya' : ''}
                                    </p>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
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
      ) : (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Kuota rombongan per tanggal</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Maksimal {eduQuota} rombongan per hari untuk semua paket eduwisata & kegiatan (Edu Trip Kesek dan Package 1–3).
                  Label &quot;Tersedia&quot; berarti kuota belum terpakai (belum ada booking). Pilih tanggal untuk melihat detail booking.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="inline-block h-3.5 w-3.5 rounded-md border border-emerald-300 bg-emerald-50" aria-hidden="true" />
                  Tersedia
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="inline-block h-3.5 w-3.5 rounded-md border border-amber-300 bg-amber-200" aria-hidden="true" />
                  Terisi sebagian
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="inline-block h-3.5 w-3.5 rounded-md border border-red-300 bg-red-100" aria-hidden="true" />
                  {eduQuota} rombongan (penuh)
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="inline-block h-3.5 w-3.5 rounded-md bg-orange-500 ring-2 ring-orange-600" aria-hidden="true" />
                  Terpilih
                </span>
              </div>
            </div>

            <div
              className="rounded-xl bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3 sm:px-4">
                <p className="text-sm font-bold text-gray-800">{monthBounds?.label}</p>
                <p className="text-xs text-gray-500">
                  Kuota {eduQuota} rombongan/hari
                </p>
              </div>
              <div className="overflow-auto p-2 sm:p-4">
                <div className="grid min-w-[560px] grid-cols-7 gap-1">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((label) => (
                    <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
                      {label}
                    </div>
                  ))}
                  {Array.from({ length: eduMondayOffset }, (_, index) => (
                    <div key={`empty-${index}`} />
                  ))}
                  {monthDateColumns.map(({ dateKey }) => {
                    const used = eduUsedByDate[dateKey] || 0
                    const full = used >= eduQuota
                    const isSelected = selectedEduDate === dateKey

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => setSelectedEduDate(isSelected ? null : dateKey)}
                        aria-pressed={isSelected}
                        aria-label={`${formatDate(dateKey)}${full ? ', kuota penuh' : used > 0 ? ', terisi sebagian' : ', tersedia'}`}
                        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-semibold transition sm:text-sm ${
                          isSelected
                            ? 'border-orange-400 bg-orange-500 text-white shadow-sm'
                            : full
                              ? 'cursor-pointer border-red-200 bg-red-50 text-red-600'
                              : used > 0
                                ? 'cursor-pointer border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-50'
                                : 'cursor-pointer border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide">{weekdayLabel(dateKey)}</span>
                        <span className="text-[10px] font-normal text-gray-500">{formatDate(dateKey)}</span>
                        <span className={`inline-flex min-w-8 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isSelected ? 'bg-white/25 text-white' : cellBadgeClasses(used, full)}`}>
                          {full ? 'Penuh' : used > 0 ? 'Terisi' : 'Tersedia'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-gray-900">
                  {selectedEduDate ? `Detail booking ${formatDate(selectedEduDate)}` : 'Semua booking bulan ini'}
                </h2>
              </div>
              {selectedEduDate && (
                <button
                  type="button"
                  onClick={() => setSelectedEduDate(null)}
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  Tampilkan semua
                </button>
              )}
            </div>
            {visibleEduTrips.length === 0 ? (
              <p className="py-10 text-center text-gray-500">
                {selectedEduDate
                  ? `Tidak ada booking pada ${formatDate(selectedEduDate)} — kuota rombongan masih tersedia (${eduUsedByDate[selectedEduDate] || 0}/${eduQuota} terpakai).`
                  : 'Belum ada booking eduwisata pada bulan ini.'}
              </p>
            ) : (
              <div className="admin-table-scroll mt-3 rounded-xl border border-gray-100" data-lenis-prevent data-scroll-container>
                <div className="overflow-auto">
                  <table className="min-w-[820px] w-full text-left text-sm">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Nama pemesan</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Paket</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Peserta</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Kode</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {visibleEduTrips.map((booking) => (
                        <tr key={booking.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                            {formatDate(booking.booking_date)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{booking.customer_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{eduPackageName(booking)}</td>
                          <td className="px-4 py-3 text-gray-700">{eduParticipantCount(booking)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{booking.booking_code || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClasses(booking.status)}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/invoice/${booking.id}?phone=${encodeURIComponent(booking.customer_phone || '')}`}
                              className="text-sm font-semibold text-emerald-700 hover:underline"
                            >
                              Invoice
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{eduSummary.totalRombongan}</p>
                <p className="mt-1 text-xs text-gray-500">Total rombongan bulan ini</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{eduSummary.fullDays}</p>
                <p className="mt-1 text-xs text-gray-500">Hari kuota penuh</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
