'use client'

import { useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

const timeSlots = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`)

const scheduleItems = [
  { id: 'htm', name: 'HTM (Tiket Masuk)', category: 'tiket', type: 'ticket' },
  { id: 'kolam-anak', name: 'Kolam Anak', category: 'tiket', type: 'ticket' },
  { id: 'wahana-anak', name: 'Wahana Anak', category: 'tiket', type: 'ticket' },
  { id: 'berenang', name: 'Berenang', category: 'tiket', type: 'ticket' },
  { id: 'terapi-ikan', name: 'Terapi Ikan', category: 'aktivitas', type: 'ticket' },
  { id: 'keceh-kali', name: 'Keceh Kali', category: 'aktivitas', type: 'ticket' },
  { id: 'tangkap-ikan', name: 'Tangkap Ikan', category: 'aktivitas', type: 'ticket' },
  { id: 'tanam-padi', name: 'Tanam Padi', category: 'aktivitas', type: 'ticket' },
  { id: 'tanam-sayur', name: 'Tanam Sayur', category: 'aktivitas', type: 'ticket' },
  { id: 'cooking-class', name: 'Cooking Class', category: 'aktivitas', type: 'ticket' },
  { id: 'fun-game', name: 'Fun Game', category: 'aktivitas', type: 'ticket' },
  { id: 'pendopo', name: 'Pendopo', category: 'sewa-tempat', type: 'rental' },
  { id: 'pendopo-besar', name: 'Pendopo Besar', category: 'sewa-tempat', type: 'rental' },
  { id: 'gazebo', name: 'Gazebo', category: 'sewa-tempat', type: 'rental' },
  { id: 'gazebo-bawah', name: 'Gazebo Bawah', category: 'sewa-tempat', type: 'rental' },
  { id: 'aula-dalam', name: 'Aula Dalam', category: 'sewa-tempat', type: 'rental' },
  { id: 'aula-teras', name: 'Aula Teras', category: 'sewa-tempat', type: 'rental' },
  { id: 'aula-full', name: 'Aula Full', category: 'sewa-tempat', type: 'rental' },
  { id: 'aula-sungai', name: 'Aula Sungai', category: 'sewa-tempat', type: 'rental' },
  { id: 'outbound', name: 'Outbound', category: 'sewa-tempat', type: 'rental' },
  { id: 'homestay-1', name: 'Aren 1', category: 'homestay', type: 'rental' },
  { id: 'homestay-2', name: 'Aren 2', category: 'homestay', type: 'rental' },
  { id: 'homestay-3', name: 'Aren 3', category: 'homestay', type: 'rental' },
  { id: 'homestay-4', name: 'Aren 4', category: 'homestay', type: 'rental' },
  { id: 'spot-tenda', name: 'Spot Tenda', category: 'camping', type: 'rental' },
  { id: 'spot-tenda-besar', name: 'Spot Tenda Besar', category: 'camping', type: 'rental' },
  { id: 'tenda-4', name: 'Tenda 4 Orang', category: 'camping', type: 'rental' },
  { id: 'alat-pancing', name: 'Sewa Alat Pancing', category: 'fishing', type: 'rental' },
]

const categories = [
  { id: 'semua', name: 'Semua' },
  { id: 'tiket', name: '🎫 Tiket' },
  { id: 'aktivitas', name: '🎯 Aktivitas' },
  { id: 'sewa-tempat', name: '🏠 Sewa Tempat' },
  { id: 'homestay', name: '🏡 Homestay' },
  { id: 'camping', name: '🏕️ Camping' },
  { id: 'fishing', name: '🎣 Fishing' },
]

const bookedSlots: Record<string, string[]> = {
  '2026-07-22': ['aula-dalam-08:00', 'aula-dalam-09:00', 'joglo-13:00', 'joglo-14:00', 'homestay-1'],
  '2026-07-23': ['aula-full-10:00', 'aula-full-11:00', 'aula-full-12:00'],
}

type ViewMode = 'hari' | 'item'

export default function JadwalPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedCategory, setSelectedCategory] = useState('semua')
  const [viewMode, setViewMode] = useState<ViewMode>('hari')

  const filteredItems = selectedCategory === 'semua'
    ? scheduleItems
    : scheduleItems.filter((item) => item.category === selectedCategory)

  const getBookingKey = (itemId: string, time?: string) =>
    time ? `${itemId}-${time}` : itemId

  const isBooked = (itemId: string, time?: string) => {
    const key = getBookingKey(itemId, time)
    return bookedSlots[selectedDate]?.includes(key) || false
  }

  return (
    <>
      <Hero title="Jadwal & Ketersediaan" subtitle="Lihat jadwal booking dan slot yang tersedia" height="sm" />

      <Section>
        <div className="max-w-6xl mx-auto">
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

          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {viewMode === 'hari' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
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
                            <span className={`w-2 h-2 rounded-full ${
                              item.type === 'ticket' ? 'bg-blue-500' : 'bg-amber-500'
                            }`} />
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
                                  {booked ? '✕' : '✓'}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="p-2 text-center">
                          <span className={`inline-block w-full py-1.5 rounded text-xs font-medium ${
                            isBooked(item.id)
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isBooked(item.id) ? 'Full' : 'Tersedia'}
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
                const booked = isBooked(item.id)
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
                    <p className={`text-sm font-medium ${booked ? 'text-red-600' : 'text-emerald-600'}`}>
                      {booked ? '✕ Sudah dibooking' : '✓ Tersedia'}
                    </p>
                    {booked && item.type === 'rental' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Slot waktu tertentu sudah terisi
                      </p>
                    )}
                    <a
                      href={`/booking/${item.type === 'ticket' ? 'wisata' : 'wisata'}?item=${item.id}`}
                      className={`mt-3 inline-block text-sm font-medium ${
                        booked ? 'text-gray-400 cursor-not-allowed' : 'text-emerald-600 hover:text-emerald-700'
                      }`}
                    >
                      {booked ? 'Tidak tersedia' : 'Booking &rarr;'}
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-6 flex items-center gap-6 text-sm text-gray-500">
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
