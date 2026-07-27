'use client'

import { useEffect, useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import CategoryVisualHeader from '@/components/CategoryVisualHeader'
import { getServiceCategory, serviceCategories } from '@/lib/service-categories'
import {
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`)

interface InventoryItem {
  id: string
  name: string
  category: string
  available: boolean
}

interface RentalBooking {
  item_id: string
  time_start: string
  time_end: string
  booking_date: string
  status: string
}

const scheduleCategoryIds = new Set([
  'semua', 'tiket', 'aktivitas', 'sewa-tempat', 'homestay', 'camping', 'fishing',
])

const categories = serviceCategories.filter((c) => scheduleCategoryIds.has(c.id))

const rentalCategories = new Set(['ruangan', 'homestay', 'camping', 'fishing'])

function isRentalCategory(cat: string): boolean {
  return rentalCategories.has(cat)
}

type ViewMode = 'hari' | 'item'

export default function JadwalPage() {
  const [mounted, setMounted] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDate(today)
    setMounted(true)
  }, [])
  const [selectedCategory, setSelectedCategory] = useState('semua')
  const [viewMode, setViewMode] = useState<ViewMode>('hari')
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [rentalBookings, setRentalBookings] = useState<RentalBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError('')
      try {
        const [invRes, bookingRes] = await Promise.all([
          fetch('/api/inventory-rentals'),
          fetch(`/api/bookings?start_date=${selectedDate}&end_date=${selectedDate}`),
        ])
        if (invRes.ok) {
          const items = await invRes.json()
          setInventoryItems(items)
        }
        if (bookingRes.ok) {
          const bookings = await bookingRes.json()
          const rentalEntries: RentalBooking[] = []
          for (const b of bookings) {
            if (b.items && Array.isArray(b.items)) {
              for (const item of b.items) {
                rentalEntries.push({
                  item_id: item.id || item.itemId,
                  time_start: b.time_start || '',
                  time_end: b.time_end || '',
                  booking_date: b.booking_date || selectedDate,
                  status: b.status,
                })
              }
            }
          }
          setRentalBookings(rentalEntries)
        }
        if (!invRes.ok || !bookingRes.ok) {
          setError('Gagal memuat jadwal')
        }
      } catch (e) {
        console.error('Failed to load schedule:', e)
        setError('Gagal memuat jadwal')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedDate])

  const scheduleItems = inventoryItems.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    type: (isRentalCategory(item.category) ? 'rental' : 'ticket') as 'rental' | 'ticket',
  }))

  const filteredItems = selectedCategory === 'semua'
    ? scheduleItems
    : scheduleItems.filter((item) => item.category === selectedCategory)
  const activeCategoryInfo = getServiceCategory(selectedCategory)

  const isBooked = (itemId: string, time?: string) => {
    return rentalBookings.some((rb) => {
      if (rb.item_id !== itemId) return false
      if (rb.status === 'cancelled') return false
      if (time) {
        if (!rb.time_start) return true
        const rbStart = rb.time_start.substring(0, 5)
        const rbEnd = rb.time_end ? rb.time_end.substring(0, 5) : rbStart
        return time >= rbStart && time < rbEnd
      }
      return true
    })
  }

  const isItemBooked = (itemId: string) => {
    return rentalBookings.some(
      (rb) => rb.item_id === itemId && rb.status !== 'cancelled'
    )
  }

  if (!mounted || loading) {
    return (
      <>
        <Hero title="Jadwal & Ketersediaan" subtitle="Memuat data..." image="/images/village-landscape.jpg" height="sm" />
        <Section>
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        </Section>
      </>
    )
  }

  return (
    <>
      <Hero title="Jadwal & Ketersediaan" subtitle="Lihat jadwal booking dan slot yang tersedia" image="/images/village-landscape.jpg" height="sm" />

      <Section>
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="rounded-xl bg-red-50 p-6 text-center text-red-700 mb-6">
              <p className="text-lg font-medium mb-1">{error}</p>
              <button onClick={() => window.location.reload()} className="text-sm text-red-600 underline">
                Coba lagi
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1">
              <label className="form-label">Pilih Tanggal</label>
              <input
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="form-label">Mode Lihat</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('hari')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'hari' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Per Hari
                </button>
                <button
                  onClick={() => setViewMode('item')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'item' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Per Item
                </button>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                aria-pressed={selectedCategory === category.id}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <CategoryVisualHeader category={activeCategoryInfo} compact />

          {viewMode === 'hari' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="min-w-[1120px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-3 font-semibold text-gray-700 min-w-[180px]">Item</th>
                      {timeSlots.map((time) => (
                        <th key={time} className="p-3 font-semibold text-gray-700 text-center min-w-[70px]">
                          {time}
                        </th>
                      ))}
                      <th className="p-3 font-semibold text-gray-700 text-center min-w-[80px]">Harian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${item.type === 'ticket' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                            {item.name}
                          </div>
                        </td>
                        {timeSlots.map((time) => {
                          const booked = isBooked(item.id, time)
                          const isRental = item.type === 'rental'
                          return (
                            <td key={time} className="p-2 text-center">
                              {isRental ? (
                                <span className={`inline-block w-full py-1.5 rounded text-xs font-medium ${
                                  booked
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {booked ? (
                                    <XMarkIcon className="mx-auto h-4 w-4" />
                                  ) : (
                                    <CheckIcon className="mx-auto h-4 w-4" />
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="p-2 text-center">
                          <span className={`inline-block w-full py-1.5 rounded text-xs font-medium ${
                            isItemBooked(item.id)
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isItemBooked(item.id) ? 'Full' : 'Tersedia'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const booked = isItemBooked(item.id)
                return (
                  <div key={item.id} className={`card p-5 border-l-4 ${
                    booked ? 'border-l-red-500' : 'border-l-emerald-500'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        item.type === 'ticket' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.type === 'ticket' ? 'Tiket' : 'Sewa'}
                      </span>
                    </div>
                    <p className={`flex items-center gap-1.5 text-sm font-medium ${booked ? 'text-red-600' : 'text-emerald-600'}`}>
                      {booked ? (
                        <XMarkIcon className="h-4 w-4" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                      {booked ? 'Sudah dibooking' : 'Tersedia'}
                    </p>
                    {booked && item.type === 'rental' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Slot waktu tertentu sudah terisi
                      </p>
                    )}
                    <a
                      href={`/booking/wisata?item=${item.id}`}
                      className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium ${
                        booked ? 'text-gray-400 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                    >
                      {booked ? 'Tidak tersedia' : (
                        <>
                          Booking
                          <ArrowRightIcon className="h-4 w-4" />
                        </>
                      )}
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          {filteredItems.length === 0 && (
            <p className="py-12 text-center text-gray-500">Tidak ada item untuk kategori ini</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-gray-500 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Tersedia</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>Sudah dibooking</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Tiket (tanpa jadwal jam)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Sewa (per jam)</span>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
