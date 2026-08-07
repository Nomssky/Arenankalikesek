'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDaysIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import { isAccommodationItem } from '@repo/shared-utils'

interface InventoryItem {
  id: string
  name: string
  category: string
  available: boolean
}

interface RentalBooking {
  item_id: string
  item_name: string
  time_start: string | null
  time_end: string | null
  booking_date: string
  status: string
}

interface AccommodationItem {
  id: string
  name: string
  category: string
  bookable: boolean
  price_label: string
}

interface EduTripPackage {
  id: string
  name: string
  category: string
  price_label: string
  bookable: boolean
}

type ScheduleType = 'rental' | 'accommodation' | 'edutrip'

const rentalHourlySlots = Array.from({ length: 10 }, (_, index) => {
  const startHour = index + 7
  const endHour = startHour + 1
  return {
    start: `${String(startHour).padStart(2, '0')}:00`,
    end: `${String(endHour).padStart(2, '0')}:00`,
  }
})

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  return (hours * 60) + minutes
}

function arenaNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: (Number(value('hour')) * 60) + Number(value('minute')),
  }
}

function slotIsBooked(slot: { start: string; end: string }, bookings: RentalBooking[]) {
  const slotStart = timeToMinutes(slot.start)
  const slotEnd = timeToMinutes(slot.end)
  return bookings.some((booking) => {
    if (!booking.time_start) return true
    const bookingStart = timeToMinutes(booking.time_start)
    const bookingEnd = booking.time_end
      ? timeToMinutes(booking.time_end)
      : bookingStart + 60
    return slotStart < bookingEnd && slotEnd > bookingStart
  })
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

function monthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function dateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return parsed.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function JadwalPage() {
  const currentArenaTime = useMemo(() => arenaNow(), [])
  const today = currentArenaTime.date
  const [scheduleType, setScheduleType] = useState<ScheduleType>('rental')
  const [selectedDate, setSelectedDate] = useState(today)
  const [rentalItems, setRentalItems] = useState<InventoryItem[]>([])
  const [rentalBookings, setRentalBookings] = useState<RentalBooking[]>([])
  const [selectedRentalItemId, setSelectedRentalItemId] = useState('')
  const [selectedRentalSlotIndexes, setSelectedRentalSlotIndexes] = useState<number[]>([])
  const [rentalSelectionError, setRentalSelectionError] = useState('')
  const [accommodationItems, setAccommodationItems] = useState<AccommodationItem[]>([])
  const [selectedAccommodationId, setSelectedAccommodationId] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7))
  const [blockedByMonth, setBlockedByMonth] = useState<Record<string, string[]>>({})
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [edutripMonth, setEduTripMonth] = useState(today.slice(0, 7))
  const [edutripQuota, setEduTripQuota] = useState(2)
  const [edutripUsedByMonth, setEduTripUsedByMonth] = useState<Record<string, Record<string, number>>>({})
  const [edutripPackages, setEduTripPackages] = useState<EduTripPackage[]>([])
  const [selectedEduTripDate, setSelectedEduTripDate] = useState('')
  const [selectedEduTripPackage, setSelectedEduTripPackage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetch('/api/inventory-rentals', { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`/api/schedule?start_date=${selectedDate}&end_date=${selectedDate}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch('/api/tour-packages?available=true', { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()),
    ])
      .then(([inventory, bookings, packages]) => {
        setRentalItems(inventory.filter((item: InventoryItem) => ['area-kegiatan', 'tempat-pertemuan'].includes(item.category)))
        setRentalBookings(bookings)
        const stays = packages.filter((item: AccommodationItem) => isAccommodationItem(item.id))
        setAccommodationItems(stays)
        setSelectedAccommodationId((current) => current || stays[0]?.id || '')
        setEduTripPackages(packages.filter(
          (item: EduTripPackage) => ['paket-edukasi', 'paket-kegiatan'].includes(item.category),
        ))
      })
      .catch((fetchError) => {
        if (fetchError?.name !== 'AbortError') setError('Gagal memuat jadwal. Silakan coba lagi.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [selectedDate])

  useEffect(() => {
    if (!selectedAccommodationId) return
    const controller = new AbortController()
    fetch(`/api/accommodation-availability?item_id=${encodeURIComponent(selectedAccommodationId)}&month=${calendarMonth}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setBlockedByMonth((current) => ({ ...current, [calendarMonth]: data.blockedDates || [] })))
      .catch(() => undefined)
    return () => controller.abort()
  }, [selectedAccommodationId, calendarMonth])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/edu-trip-availability?month=${edutripMonth}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setEduTripQuota(Number(data.quota) || 2)
        setEduTripUsedByMonth((current) => ({ ...current, [edutripMonth]: data.byDate || {} }))
      })
      .catch((fetchError) => {
        if (fetchError?.name !== 'AbortError') setError('Gagal memuat kuota Eduwisata. Silakan coba lagi.')
      })
    return () => controller.abort()
  }, [edutripMonth])

  const blockedDates = Object.values(blockedByMonth).flat()
  const selectedAccommodation = accommodationItems.find((item) => item.id === selectedAccommodationId)
  const canContinueAccommodationBooking = Boolean(selectedAccommodation?.bookable && checkIn && checkOut)
  const accommodationBookingHref = selectedAccommodation
    ? `/booking/wisata?item=${encodeURIComponent(selectedAccommodation.id)}${
        checkIn && checkOut
          ? `&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&directBooking=1`
          : ''
      }`
    : '/booking/wisata?category=penginapan-camping'

  const edutripUsedByDate = edutripUsedByMonth[edutripMonth] || {}
  const edutripBlockedSet = new Set(
    Object.entries(edutripUsedByDate)
      .filter(([, used]) => used >= edutripQuota)
      .map(([date]) => date),
  )
  const selectedEduTripUsed = selectedEduTripDate
    ? (edutripUsedByMonth[selectedEduTripDate.slice(0, 7)]?.[selectedEduTripDate] ?? 0)
    : 0
  const selectedEduTripRemaining = Math.max(0, edutripQuota - selectedEduTripUsed)
  const selectedEduTripPackageInfo = edutripPackages.find((item) => item.id === selectedEduTripPackage)
  const canContinueEduTripBooking = Boolean(
    selectedEduTripDate
    && selectedEduTripRemaining > 0
    && selectedEduTripPackageInfo?.bookable,
  )
  const edutripBookingHref = selectedEduTripPackageInfo
    ? `/booking/wisata?item=${encodeURIComponent(selectedEduTripPackageInfo.id)}${
        selectedEduTripDate ? `&bookingDate=${encodeURIComponent(selectedEduTripDate)}` : ''
      }&directBooking=1`
    : '/booking/wisata?category=paket-edukasi'

  const [edutripYear, edutripMonthNumber] = edutripMonth.split('-').map(Number)
  const edutripFirstDay = new Date(Date.UTC(edutripYear, edutripMonthNumber - 1, 1))
  const edutripNumberOfDays = new Date(Date.UTC(edutripYear, edutripMonthNumber, 0)).getUTCDate()
  const edutripMondayOffset = (edutripFirstDay.getUTCDay() + 6) % 7
  const edutripPreviousMonth = shiftMonth(edutripMonth, -1)
  const canGoPreviousEduTrip = !today || `${edutripPreviousMonth}-31` >= today

  const itemBookings = (item: InventoryItem) => rentalBookings.filter((booking) => {
    if (booking.status === 'cancelled') return false
    return booking.item_id === item.id || Boolean(
      booking.item_name && (
        item.name.toLowerCase().includes(booking.item_name.toLowerCase()) ||
        booking.item_name.toLowerCase().includes(item.name.toLowerCase())
      )
    )
  })

  const selectRentalSlot = (item: InventoryItem, slotIndex: number) => {
    const bookings = itemBookings(item)
    const slotIsPast = selectedDate === today
      && timeToMinutes(rentalHourlySlots[slotIndex].start) <= currentArenaTime.minutes
    if (slotIsBooked(rentalHourlySlots[slotIndex], bookings) || slotIsPast) return
    if (selectedRentalItemId !== item.id || selectedRentalSlotIndexes.length === 0) {
      setRentalSelectionError('')
      setSelectedRentalItemId(item.id)
      setSelectedRentalSlotIndexes([slotIndex])
      return
    }
    if (selectedRentalSlotIndexes.includes(slotIndex)) {
      setRentalSelectionError('')
      setSelectedRentalSlotIndexes(selectedRentalSlotIndexes.length === 1 ? [] : [slotIndex])
      return
    }
    const firstIndex = Math.min(slotIndex, ...selectedRentalSlotIndexes)
    const lastIndex = Math.max(slotIndex, ...selectedRentalSlotIndexes)
    const nextIndexes = Array.from({ length: lastIndex - firstIndex + 1 }, (_, index) => firstIndex + index)
    if (nextIndexes.some((index) => {
      const slot = rentalHourlySlots[index]
      return slotIsBooked(slot, bookings)
        || (selectedDate === today && timeToMinutes(slot.start) <= currentArenaTime.minutes)
    })) {
      setRentalSelectionError('Rentang tersebut melewati slot yang tidak tersedia. Pilih rentang lain tanpa melewati slot terisi atau sudah lewat.')
      return
    }
    setRentalSelectionError('')
    setSelectedRentalSlotIndexes(nextIndexes)
  }

  return (
    <>
      <Hero
        title="Jadwal & Ketersediaan"
        subtitle="Periksa slot sewa tempat dan tanggal menginap tanpa mencampur kedua jenis jadwal"
        image="/images/village-landscape.jpg"
        height="full"
      />

      <Section>
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 grid grid-cols-3 rounded-2xl bg-emerald-950 p-1.5 text-sm font-semibold text-white shadow-lg sm:max-w-2xl">
            <button type="button" onClick={() => setScheduleType('rental')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'rental' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Sewa Tempat
            </button>
            <button type="button" onClick={() => setScheduleType('accommodation')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'accommodation' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Penginapan & Camping
            </button>
            <button type="button" onClick={() => setScheduleType('edutrip')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'edutrip' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Eduwisata dan Kegiatan
            </button>
          </div>

          {error && <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {scheduleType === 'rental' ? (
            <div>
              <div className="mb-6 max-w-sm">
                <label className="form-label">Tanggal sewa</label>
                <input type="date" min={today} aria-label="Tanggal sewa" className="form-input" value={selectedDate} onChange={(event) => { setLoading(true); setError(''); setRentalSelectionError(''); setSelectedRentalItemId(''); setSelectedRentalSlotIndexes([]); setSelectedDate(event.target.value) }} />
                <p className="mt-2 text-xs leading-5 text-gray-500">Jam operasional 07.00–17.00 WIB. Pilih satu atau beberapa slot yang berurutan.</p>
              </div>
              {rentalSelectionError && (
                <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {rentalSelectionError}
                </div>
              )}
              {loading ? (
                <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>
              ) : rentalItems.length === 0 ? (
                <p className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">Belum ada data sewa tempat.</p>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  {rentalItems.map((item) => {
                    const bookings = itemBookings(item)
                    const bookedSlots = rentalHourlySlots.map((slot) => slotIsBooked(slot, bookings))
                    const pastSlots = rentalHourlySlots.map((slot) => (
                      selectedDate === today && timeToMinutes(slot.start) <= currentArenaTime.minutes
                    ))
                    const availableSlotCount = bookedSlots.filter((isBooked, index) => !isBooked && !pastSlots[index]).length
                    const itemIsSelected = selectedRentalItemId === item.id && selectedRentalSlotIndexes.length > 0
                    const selectedIndexes = itemIsSelected
                      ? [...selectedRentalSlotIndexes].sort((first, second) => first - second)
                      : []
                    const selectedStart = selectedIndexes.length
                      ? rentalHourlySlots[selectedIndexes[0]].start
                      : ''
                    const selectedEnd = selectedIndexes.length
                      ? rentalHourlySlots[selectedIndexes[selectedIndexes.length - 1]].end
                      : ''
                    const bookingHref = itemIsSelected
                      ? `/booking/wisata?item=${encodeURIComponent(item.id)}&bookingDate=${encodeURIComponent(selectedDate)}&timeStart=${encodeURIComponent(selectedStart)}&timeEnd=${encodeURIComponent(selectedEnd)}&directBooking=1`
                      : '#'
                    return (
                      <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${itemIsSelected ? 'border-orange-300 ring-2 ring-orange-100' : 'border-emerald-950/5'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">Sewa tempat</p>
                            <h2 className="mt-1 font-bold text-emerald-950">{item.name}</h2>
                          </div>
                          {availableSlotCount > 0 ? <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-500" /> : <XCircleIcon className="h-6 w-6 shrink-0 text-red-500" />}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-emerald-700">{availableSlotCount} slot tersedia</span>
                          <span className="text-gray-500">Pilih per jam</span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {rentalHourlySlots.map((slot, slotIndex) => {
                            const isBooked = bookedSlots[slotIndex]
                            const isPast = pastSlots[slotIndex]
                            const isSelected = itemIsSelected && selectedRentalSlotIndexes.includes(slotIndex)
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                disabled={isBooked || isPast}
                                aria-pressed={isSelected}
                                onClick={() => selectRentalSlot(item, slotIndex)}
                                className={`min-h-14 rounded-xl border px-2 py-2 text-center transition ${
                                  isSelected
                                    ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                                    : isBooked
                                      ? 'cursor-not-allowed border-red-100 bg-red-50 text-red-400 line-through'
                                      : isPast
                                        ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                                      : 'border-emerald-100 bg-emerald-50/60 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50'
                                }`}
                              >
                                <span className="block text-xs font-bold">{slot.start}</span>
                                <span className={`mt-0.5 block text-[10px] ${isSelected ? 'text-white/75' : 'opacity-70'}`}>
                                  {isBooked ? 'Terisi' : isPast ? 'Sudah lewat' : `s.d. ${slot.end}`}
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        {itemIsSelected && (
                          <div className="mt-4 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-800">
                            <ClockIcon className="h-4 w-4 shrink-0" />
                            <span className="font-semibold">Dipilih {selectedStart}–{selectedEnd} · {selectedIndexes.length} jam</span>
                          </div>
                        )}

                        <Link
                          href={bookingHref}
                          aria-disabled={!itemIsSelected}
                          className={`mt-4 block w-full rounded-full px-5 py-3 text-center text-sm font-bold transition ${itemIsSelected ? 'bg-orange-500 text-white hover:bg-orange-400' : 'pointer-events-none bg-gray-100 text-gray-400'}`}
                        >
                          {itemIsSelected ? 'Lanjut isi data booking' : 'Pilih jam terlebih dahulu'}
                        </Link>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          ) : scheduleType === 'accommodation' ? (
            <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 lg:self-start">
                <label className="form-label">Unit penginapan/camping</label>
                <select
                  aria-label="Unit penginapan atau camping"
                  className="form-select"
                  value={selectedAccommodationId}
                  onChange={(event) => {
                    setSelectedAccommodationId(event.target.value)
                    setBlockedByMonth({})
                    setCheckIn('')
                    setCheckOut('')
                  }}
                >
                  {accommodationItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {selectedAccommodation && (
                  <div className="mt-4 rounded-xl bg-white p-4">
                    <p className="font-bold text-emerald-950">{selectedAccommodation.name}</p>
                    <p className="mt-1 text-sm text-orange-600">{selectedAccommodation.price_label}</p>
                    {!selectedAccommodation.bookable && <p className="mt-2 text-xs text-gray-500">Harga belum tersedia; hubungi pengelola.</p>}
                  </div>
                )}
                <div className="mt-4 text-xs leading-5 text-gray-600">
                  <p className="flex items-center gap-2 font-semibold text-emerald-900"><CalendarDaysIcon className="h-4 w-4" />Cara memilih</p>
                  <p className="mt-1">Pilih check-in lalu check-out. Hari check-out tidak dihitung sebagai malam menginap.</p>
                </div>
              </aside>
              <div>
                <AvailabilityCalendar
                  month={calendarMonth}
                  minimumDate={today}
                  blockedDates={blockedDates}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onMonthChange={setCalendarMonth}
                  onChange={(nextIn, nextOut) => { setCheckIn(nextIn); setCheckOut(nextOut) }}
                />
                <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-emerald-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-white/60">Pilihan tanggal</p>
                    <p className="font-semibold">{checkIn || 'Check-in belum dipilih'}{checkOut ? ` → ${checkOut}` : ''}</p>
                  </div>
                  <Link
                    href={accommodationBookingHref}
                    aria-disabled={!canContinueAccommodationBooking}
                    className={`rounded-full px-5 py-3 text-center text-sm font-bold ${canContinueAccommodationBooking ? 'bg-orange-500 text-white hover:bg-orange-400' : 'pointer-events-none bg-white/10 text-white/40'}`}
                  >
                    {checkIn && checkOut ? 'Lanjut booking' : 'Pilih tanggal dahulu'}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 lg:self-start">
                <label className="form-label">Pilih paket</label>
                <select
                  aria-label="Pilih paket eduwisata atau kegiatan"
                  className="form-select"
                  value={selectedEduTripPackage}
                  onChange={(event) => setSelectedEduTripPackage(event.target.value)}
                >
                  <option value="">-- Pilih paket --</option>
                  {edutripPackages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.price_label}/orang
                    </option>
                  ))}
                </select>
                {selectedEduTripPackageInfo && (
                  <div className="mt-4 rounded-xl bg-white p-4">
                    <p className="font-bold text-emerald-950">{selectedEduTripPackageInfo.name}</p>
                    <p className="mt-1 text-sm text-orange-600">{selectedEduTripPackageInfo.price_label}/orang</p>
                    {!selectedEduTripPackageInfo.bookable && <p className="mt-2 text-xs text-gray-500">Harga belum tersedia; hubungi pengelola.</p>}
                  </div>
                )}
                <div className="mt-4 text-xs leading-5 text-gray-600">
                  <p className="flex items-center gap-2 font-semibold text-emerald-900"><CalendarDaysIcon className="h-4 w-4" />Cara memilih</p>
                  <p className="mt-1">Pilih paket, lalu pilih satu tanggal. Kuota maksimal {edutripQuota} rombongan per hari untuk seluruh paket eduwisata dan kegiatan. Harga berlaku untuk minimal 25 anak.</p>
                </div>
              </aside>
              <div>
                <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-emerald-50 px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    aria-label="Bulan sebelumnya"
                    disabled={!canGoPreviousEduTrip}
                    onClick={() => { setEduTripMonth(edutripPreviousMonth); setSelectedEduTripDate('') }}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <p className="text-sm font-bold capitalize text-emerald-950">{monthLabel(edutripMonth)}</p>
                  <button
                    type="button"
                    aria-label="Bulan berikutnya"
                    onClick={() => { setEduTripMonth(shiftMonth(edutripMonth, 1)); setSelectedEduTripDate('') }}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 p-2 sm:p-4">
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((label) => (
                    <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
                      {label}
                    </div>
                  ))}
                  {Array.from({ length: edutripMondayOffset }, (_, index) => <div key={`empty-${index}`} />)}
                  {Array.from({ length: edutripNumberOfDays }, (_, index) => {
                    const date = `${edutripMonth}-${String(index + 1).padStart(2, '0')}`
                    const isPast = Boolean(today && date < today)
                    const isFull = edutripBlockedSet.has(date)
                    const isSelected = date === selectedEduTripDate
                    const disabled = isPast || isFull
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedEduTripDate(date)}
                        aria-label={`${date}${isFull ? ', kuota penuh' : isPast ? ', sudah lewat' : ', tersedia'}`}
                        className={`relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-xs font-semibold transition sm:text-sm ${
                          isSelected
                            ? 'bg-orange-500 text-white ring-2 ring-orange-600 shadow-sm'
                            : isFull
                              ? 'cursor-not-allowed border border-red-300 bg-red-100 text-red-600 line-through'
                              : isPast
                                ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:ring-2 hover:ring-emerald-300'
                        }`}
                      >
                        {index + 1}
                      </button>
                    )
                  })}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-emerald-50 px-4 py-3 text-[11px] text-gray-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded-md border border-emerald-300 bg-emerald-50" />
                    Tersedia
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded-md border border-red-300 bg-red-100" />
                    Kuota penuh
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded-md border border-gray-200 bg-gray-100" />
                    Sudah lewat
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded-md bg-orange-500 ring-2 ring-orange-600" />
                    Pilihan Anda
                  </span>
                </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-emerald-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-white/60">Pilihan tanggal</p>
                    <p className="font-semibold">
                      {selectedEduTripDate ? dateLabel(selectedEduTripDate) : 'Tanggal belum dipilih'}
                      {selectedEduTripDate && (
                        <span className="text-white/70">
                          {selectedEduTripRemaining > 0
                            ? ` · tersisa ${selectedEduTripRemaining} dari ${edutripQuota} kuota`
                            : ' · kuota penuh'}
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={edutripBookingHref}
                    aria-disabled={!canContinueEduTripBooking}
                    className={`rounded-full px-5 py-3 text-center text-sm font-bold ${canContinueEduTripBooking ? 'bg-orange-500 text-white hover:bg-orange-400' : 'pointer-events-none bg-white/10 text-white/40'}`}
                  >
                    {canContinueEduTripBooking ? 'Lanjut booking' : 'Pilih tanggal & paket'}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>
    </>
  )
}
