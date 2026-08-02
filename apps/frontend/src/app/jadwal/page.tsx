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

export default function JadwalPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [scheduleType, setScheduleType] = useState<ScheduleType>('rental')
  const [selectedDate, setSelectedDate] = useState(today)
  const [rentalItems, setRentalItems] = useState<InventoryItem[]>([])
  const [rentalBookings, setRentalBookings] = useState<RentalBooking[]>([])
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

  const itemBookings = (item: InventoryItem) => rentalBookings.filter((booking) => {
    if (booking.status === 'cancelled') return false
    return booking.item_id === item.id || Boolean(
      booking.item_name && (
        item.name.toLowerCase().includes(booking.item_name.toLowerCase()) ||
        booking.item_name.toLowerCase().includes(item.name.toLowerCase())
      )
    )
  })

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
                <input type="date" min={today} className="form-input" value={selectedDate} onChange={(event) => { setLoading(true); setError(''); setSelectedDate(event.target.value) }} />
              </div>
              {loading ? (
                <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>
              ) : rentalItems.length === 0 ? (
                <p className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">Belum ada data sewa tempat.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rentalItems.map((item) => {
                    const bookings = itemBookings(item)
                    const available = bookings.length === 0
                    return (
                      <article key={item.id} className="rounded-2xl border border-emerald-950/5 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">Sewa tempat</p>
                            <h2 className="mt-1 font-bold text-emerald-950">{item.name}</h2>
                          </div>
                          {available ? <CheckCircleIcon className="h-6 w-6 shrink-0 text-emerald-500" /> : <XCircleIcon className="h-6 w-6 shrink-0 text-red-500" />}
                        </div>
                        <div className={`mt-4 rounded-xl px-3 py-3 text-sm ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          <p className="font-semibold">{available ? 'Semua slot tersedia' : 'Ada slot yang sudah terisi'}</p>
                          {!available && (
                            <div className="mt-2 space-y-1 text-xs">
                              {bookings.map((booking, index) => (
                                <p key={`${booking.item_id}-${index}`} className="flex items-center gap-1.5">
                                  <ClockIcon className="h-4 w-4" />
                                  {booking.time_start?.slice(0, 5) || 'Seharian'}{booking.time_end ? `–${booking.time_end.slice(0, 5)}` : ''}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <Link href={`/booking/wisata?item=${item.id}`} className="btn-outline mt-4 w-full text-sm">Pilih jadwal booking</Link>
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
                    href={selectedAccommodation ? `/booking/wisata?item=${selectedAccommodation.id}` : '/booking/wisata?category=penginapan-camping'}
                    aria-disabled={!selectedAccommodation?.bookable}
                    className={`rounded-full px-5 py-3 text-center text-sm font-bold ${selectedAccommodation?.bookable ? 'bg-orange-500 text-white hover:bg-orange-400' : 'pointer-events-none bg-white/10 text-white/40'}`}
                  >
                    Lanjut booking
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
