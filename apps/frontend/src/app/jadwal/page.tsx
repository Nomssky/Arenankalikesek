'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDaysIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline'
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

type ScheduleType = 'rental' | 'accommodation'

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
          <div className="mb-7 grid grid-cols-2 rounded-2xl bg-emerald-950 p-1.5 text-sm font-semibold text-white shadow-lg sm:max-w-xl">
            <button type="button" onClick={() => setScheduleType('rental')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'rental' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Sewa Tempat
            </button>
            <button type="button" onClick={() => setScheduleType('accommodation')} className={`rounded-xl px-3 py-3 transition ${scheduleType === 'accommodation' ? 'bg-orange-500 shadow-sm' : 'text-white/70 hover:text-white'}`}>
              Penginapan & Camping
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
          ) : (
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
          )}
        </div>
      </Section>
    </>
  )
}
