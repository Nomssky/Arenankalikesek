'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDaysIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useSearchParams } from 'next/navigation'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import AvailabilityCalendar from '@/components/AvailabilityCalendar'
import BookingModal from '@/components/BookingModal'
import type { BookingPreset } from '@/components/BookingModal'
import { isAccommodationItem } from '@repo/shared-utils'

interface InventoryItem {
  id: string
  name: string
  category: string
  available: boolean
  price_per_unit?: number
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
  price?: number
}

interface WahanaItem {
  id: string
  name: string
  category: string
  price: number | null
  price_label: string
  note: string | null
  bookable: boolean
}

type ScheduleType = 'rental' | 'accommodation' | 'edutrip' | 'wahana'

function scheduleTypeFromCategory(category: string | null): ScheduleType | null {
  if (!category) return null
  if (['area-kegiatan', 'tempat-pertemuan'].includes(category)) return 'rental'
  if (['homestay', 'camping', 'glamping', 'penginapan-camping'].includes(category)) return 'accommodation'
  if (['paket-edukasi', 'paket-kegiatan'].includes(category)) return 'edutrip'
  if (['aktivitas', 'gratis', 'fishing'].includes(category)) return 'wahana'
  return null
}

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

function shortDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

interface BookingActionBarProps {
  kicker: string
  selection: string
  onClick: () => void
  disabled?: boolean
  disabledLabel?: string
  buttonLabel?: string
}

function BookingActionBar({
  kicker,
  selection,
  onClick,
  disabled = false,
  disabledLabel = 'Pilih dahulu',
  buttonLabel = 'Lanjut Booking',
}: BookingActionBarProps) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-emerald-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-white/60">{kicker}</p>
        <p className="truncate font-semibold">{selection}</p>
      </div>
      <button
        type="button"
        aria-disabled={disabled}
        onClick={onClick}
        className={`shrink-0 rounded-full px-5 py-3 text-center text-sm font-bold transition ${
          disabled
            ? 'pointer-events-none bg-white/10 text-white/40'
            : 'bg-orange-500 text-white hover:bg-orange-400'
        }`}
      >
        {disabled ? disabledLabel : buttonLabel}
      </button>
    </div>
  )
}

export default function JadwalPage() {
  const searchParams = useSearchParams()
  const currentArenaTime = useMemo(() => arenaNow(), [])
  const today = currentArenaTime.date
  const requestedScheduleType = scheduleTypeFromCategory(searchParams.get('category'))
  const [selectedScheduleType, setSelectedScheduleType] = useState<ScheduleType | null>(null)
  const scheduleType = selectedScheduleType ?? requestedScheduleType ?? 'rental'
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
  const [wahanaItems, setWahanaItems] = useState<WahanaItem[]>([])
  const [selectedWahanaIds, setSelectedWahanaIds] = useState<string[]>([])
  const [selectedWahanaDate, setSelectedWahanaDate] = useState(today)
  const [bookingModalPreset, setBookingModalPreset] = useState<BookingPreset | null>(null)
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
        setWahanaItems(packages.filter(
          (item: WahanaItem) => ['aktivitas', 'gratis', 'fishing'].includes(item.category),
        ))
      })
      .catch((fetchError) => {
        if (fetchError?.name !== 'AbortError') setError('Gagal memuat jadwal. Silakan coba lagi.')
      })
      .finally(() => {
        // Requests for an older date can finish after a newer request starts.
        // Do not let an aborted request hide the loading state of the latest one.
        if (!controller.signal.aborted) setLoading(false)
      })
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

  const selectedRentalItem = rentalItems.find((item) => item.id === selectedRentalItemId)
  const selectedRentalSlots = [...selectedRentalSlotIndexes].sort((first, second) => first - second)
  const rentalSelectionLabel = selectedRentalItem && selectedRentalSlots.length > 0
    ? `${selectedRentalItem.name} · ${rentalHourlySlots[selectedRentalSlots[0]].start}–${rentalHourlySlots[selectedRentalSlots[selectedRentalSlots.length - 1]].end} · ${selectedRentalSlots.length} jam`
    : 'Belum ada pilihan'

  const selectedEduTripItem = edutripPackages.find((item) => item.id === selectedEduTripPackage)
  const edutripSelectionLabel = selectedEduTripItem && selectedEduTripDate
    ? `${selectedEduTripItem.name} · ${shortDateLabel(selectedEduTripDate)}`
    : 'Belum ada pilihan'

  const edutripUsedByDate = edutripUsedByMonth[edutripMonth] || {}
  const edutripBlockedSet = new Set(
    Object.entries(edutripUsedByDate)
      .filter(([, used]) => used >= edutripQuota)
      .map(([date]) => date),
  )

  const [edutripYear, edutripMonthNumber] = edutripMonth.split('-').map(Number)
  const edutripFirstDay = new Date(Date.UTC(edutripYear, edutripMonthNumber - 1, 1))
  const edutripNumberOfDays = new Date(Date.UTC(edutripYear, edutripMonthNumber, 0)).getUTCDate()
  const edutripMondayOffset = (edutripFirstDay.getUTCDay() + 6) % 7
  const edutripDates = Array.from(
    { length: edutripNumberOfDays },
    (_, index) => `${edutripMonth}-${String(index + 1).padStart(2, '0')}`,
  )
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
          <div className="mb-7 grid grid-cols-2 rounded-2xl bg-emerald-950 p-1.5 text-sm font-semibold text-white shadow-lg sm:grid-cols-4 sm:max-w-3xl">
            <button type="button" aria-pressed={scheduleType === 'rental'} onClick={() => setSelectedScheduleType('rental')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'rental' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Sewa Tempat
            </button>
            <button type="button" aria-pressed={scheduleType === 'accommodation'} onClick={() => setSelectedScheduleType('accommodation')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'accommodation' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Penginapan & Camping
            </button>
            <button type="button" aria-pressed={scheduleType === 'edutrip'} onClick={() => setSelectedScheduleType('edutrip')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'edutrip' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Eduwisata & Kegiatan
            </button>
            <button type="button" aria-pressed={scheduleType === 'wahana'} onClick={() => setSelectedScheduleType('wahana')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'wahana' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Wahana & Aktivitas
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

                      </article>
                    )
                  })}
                </div>
              )}

              <BookingActionBar
                kicker="Pilihan sewa"
                selection={rentalSelectionLabel}
                disabled={selectedRentalSlots.length === 0}
                disabledLabel="Pilih jam terlebih dahulu"
                buttonLabel="Lanjut isi data booking"
                onClick={() => {
                  if (!selectedRentalItem || selectedRentalSlots.length === 0) return
                  setBookingModalPreset({
                    kind: 'rental',
                    itemId: selectedRentalItem.id,
                    itemName: selectedRentalItem.name,
                    item: { id: selectedRentalItem.id, name: selectedRentalItem.name, category: selectedRentalItem.category, price: selectedRentalItem.price_per_unit || 0 },
                    bookingDate: selectedDate,
                    timeStart: rentalHourlySlots[selectedRentalSlots[0]].start,
                    timeEnd: rentalHourlySlots[selectedRentalSlots[selectedRentalSlots.length - 1]].end,
                  })
                }}
              />
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
                <BookingActionBar
                  kicker="Pilihan menginap"
                  selection={checkIn ? `${checkIn}${checkOut ? ` → ${checkOut}` : ''}` : 'Check-in belum dipilih'}
                  disabled={!canContinueAccommodationBooking}
                  disabledLabel="Pilih tanggal dahulu"
                  onClick={() => {
                    if (!canContinueAccommodationBooking || !selectedAccommodation) return
                    setBookingModalPreset({
                      kind: 'stay',
                      itemId: selectedAccommodation.id,
                      itemName: selectedAccommodation.name,
                      item: { id: selectedAccommodation.id, name: selectedAccommodation.name, category: 'homestay' },
                      checkIn,
                      checkOut,
                    })
                  }}
                />
              </div>
            </div>
          ) : scheduleType === 'edutrip' ? (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
              {edutripPackages.map((item) => {
                const isActive = selectedEduTripPackage === item.id && Boolean(selectedEduTripDate)
                const availableDateCount = edutripDates.filter((date) => date >= today && !edutripBlockedSet.has(date)).length
                const categoryLabel = item.category === 'paket-kegiatan' ? 'Kegiatan' : 'Eduwisata'
                return (
                  <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${isActive ? 'border-orange-300 ring-2 ring-orange-100' : 'border-emerald-950/5'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">{categoryLabel}</p>
                        <h2 className="mt-1 font-bold text-emerald-950">{item.name}</h2>
                      </div>
                      {availableDateCount > 0 ? <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-500" /> : <XCircleIcon className="h-6 w-6 shrink-0 text-red-500" />}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-emerald-700">{availableDateCount} tanggal tersedia</span>
                      <span className="text-gray-500">Pilih per hari</span>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-100">
                      <div className="flex items-center justify-between border-b border-emerald-50 px-2 py-2">
                        <button
                          type="button"
                          aria-label="Bulan sebelumnya"
                          disabled={!canGoPreviousEduTrip}
                          onClick={() => { setEduTripMonth(edutripPreviousMonth); setSelectedEduTripPackage('') }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronLeftIcon className="h-4 w-4" />
                        </button>
                        <p className="text-sm font-bold capitalize text-emerald-950">{monthLabel(edutripMonth)}</p>
                        <button
                          type="button"
                          aria-label="Bulan berikutnya"
                          onClick={() => { setEduTripMonth(shiftMonth(edutripMonth, 1)); setSelectedEduTripPackage('') }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50"
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 p-2">
                        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((label) => (
                          <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            {label}
                          </div>
                        ))}
                        {Array.from({ length: edutripMondayOffset }, (_, index) => <div key={`empty-${index}`} />)}
                        {edutripDates.map((date, index) => {
                          const isPast = Boolean(today && date < today)
                          const isFull = edutripBlockedSet.has(date)
                          const isToday = !isPast && !isFull && date === today
                          const isSelected = isActive && date === selectedEduTripDate
                          const disabled = isPast || isFull
                          return (
                            <button
                              key={date}
                              type="button"
                              disabled={disabled}
                              aria-pressed={isSelected}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedEduTripDate('')
                                  setSelectedEduTripPackage('')
                                } else {
                                  setSelectedEduTripPackage(item.id)
                                  setSelectedEduTripDate(date)
                                }
                              }}
                              aria-label={`${date}${isFull ? ', kuota penuh' : isPast ? ', sudah lewat' : ', tersedia'}${isSelected ? ', pilihan Anda' : ''}`}
                              className={`relative isolate flex h-9 min-h-9 items-center justify-center overflow-hidden rounded-xl text-xs font-semibold transition sm:text-sm ${
                                isSelected
                                  ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                                  : isFull
                                    ? 'cursor-not-allowed border-red-200 bg-red-50 font-bold text-red-700'
                                    : isPast
                                      ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-70'
                                      : isToday
                                        ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                                        : 'border-emerald-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                              }`}
                            >
                              <span className="relative z-10">{index + 1}</span>
                              {isFull && (
                                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="pointer-events-none absolute inset-0 z-0 h-full w-full text-red-200">
                                  <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3.5 w-3.5 rounded-md border border-emerald-300 bg-white" />
                        Tersedia
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-md border border-red-300 bg-red-50 text-[9px] font-bold leading-none text-red-500">×</span>
                        Penuh
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3.5 w-3.5 rounded-md border border-gray-300 bg-gray-100 opacity-70" />
                        Sudah lewat
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3.5 w-3.5 rounded-md border border-blue-300 bg-blue-50" />
                        Hari ini
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3.5 w-3.5 rounded-md border border-orange-500 bg-orange-500" />
                        Pilihan Anda
                      </span>
                    </div>

                    {isActive && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                        <CalendarDaysIcon className="h-4 w-4 shrink-0" />
                        <span className="font-semibold">Dipilih {shortDateLabel(selectedEduTripDate)}</span>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            <BookingActionBar
              kicker="Pilihan eduwisata"
              selection={edutripSelectionLabel}
              disabled={!selectedEduTripItem || !selectedEduTripDate}
              disabledLabel="Pilih tanggal terlebih dahulu"
              onClick={() => {
                if (!selectedEduTripItem || !selectedEduTripDate) return
                setBookingModalPreset({
                  kind: 'edutrip',
                  itemId: selectedEduTripItem.id,
                  itemName: selectedEduTripItem.name,
                  item: { id: selectedEduTripItem.id, name: selectedEduTripItem.name, category: selectedEduTripItem.category, price: selectedEduTripItem.price || 0 },
                  bookingDate: selectedEduTripDate,
                })
              }}
            />
            </>
          ) : (
            <div>
              <div className="mb-6 max-w-sm">
                <label className="form-label">Tanggal kunjungan</label>
                <input
                  type="date"
                  min={today}
                  aria-label="Tanggal kunjungan"
                  className="form-input"
                  value={selectedWahanaDate}
                  onChange={(event) => {
                    setSelectedWahanaDate(event.target.value)
                    setSelectedWahanaIds([])
                  }}
                />
                <p className="mt-2 text-xs leading-5 text-gray-500">Pilih satu atau beberapa wahana/aktivitas, lalu tentukan jumlah peserta saat booking.</p>
              </div>
              {wahanaItems.length === 0 ? (
                <p className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">Belum ada wahana & aktivitas.</p>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {wahanaItems.map((item) => {
                    const isSelected = selectedWahanaIds.includes(item.id)
                    return (
                      <article key={item.id} className={`flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${isSelected ? 'border-orange-300 ring-2 ring-orange-100' : 'border-emerald-950/5'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">Wahana & Aktivitas</p>
                            <h2 className="mt-1 font-bold text-emerald-950">{item.name}</h2>
                          </div>
                          {item.bookable ? <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-500" /> : <XCircleIcon className="h-6 w-6 shrink-0 text-red-500" />}
                        </div>
                        {item.note && <p className="mt-1 text-xs text-gray-500">{item.note}</p>}

                        <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                          <span className="font-semibold text-emerald-700">{item.price_label}</span>
                          <span className="text-gray-500">Pesan per orang / unit</span>
                        </div>

<button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-disabled={!item.bookable}
                          onClick={() => {
                            if (!item.bookable) return
                            setSelectedWahanaIds((current) => isSelected
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id])
                          }}
                          className={`mt-auto pt-4 block w-full rounded-full px-5 py-3 text-center text-sm font-bold transition ${isSelected ? 'bg-orange-500 text-white hover:bg-orange-400' : item.bookable ? 'border border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50' : 'pointer-events-none bg-gray-100 text-gray-400'}`}
                        >
                          {isSelected ? 'Terpilih' : item.bookable ? 'Pilih wahana' : 'Belum dapat dipesan'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              )}

{selectedWahanaIds.length > 0 && (
                <BookingActionBar
                  kicker={`${selectedWahanaIds.length} wahana dipilih`}
                  selection={selectedWahanaDate ? shortDateLabel(selectedWahanaDate) : 'Tanggal belum dipilih'}
                  disabled={!selectedWahanaDate}
                  disabledLabel="Pilih tanggal dahulu"
                  onClick={() => {
                    const selectedItems = wahanaItems.filter((entry) => selectedWahanaIds.includes(entry.id))
                    if (selectedItems.length === 0 || !selectedWahanaDate) return
                    setBookingModalPreset({
                      kind: 'edutrip',
                      itemId: selectedItems[0].id,
                      itemName: selectedItems.length === 1 ? selectedItems[0].name : `${selectedItems.length} wahana terpilih`,
                      items: selectedItems.map((item) => ({ id: item.id, name: item.name, category: item.category, price: item.price || 0 })),
                      bookingDate: selectedWahanaDate,
                    })
                  }}
                />
              )}
            </div>
          )}
        </div>
      </Section>

      <BookingModal
        open={Boolean(bookingModalPreset)}
        onClose={() => setBookingModalPreset(null)}
        preset={bookingModalPreset}
      />
    </>
  )
}
