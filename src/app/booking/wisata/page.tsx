'use client'

import { useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import CategoryVisualHeader from '@/components/CategoryVisualHeader'
import { formatPrice } from '@/lib/utils'
import { getServiceCategory, serviceCategories } from '@/lib/service-categories'

interface BookingItem {
  id: string
  name: string
  category: string
  price: number
  maxPrice?: number
  capacity?: string
  quantity: number
  note?: string
}

const items = [
  // Tiket Masuk & Wahana
  { id: 'htm', name: 'HTM (Harga Tiket Masuk)', category: 'tiket', price: 5000 },
  { id: 'kolam-anak', name: 'Kolam Anak', category: 'tiket', price: 5000 },
  { id: 'wahana-anak', name: 'Wahana Permainan Anak', category: 'tiket', price: 10000, note: '/wahana' },
  { id: 'terapi-ikan', name: 'Terapi Ikan', category: 'gratis', price: 0 },
  { id: 'keceh-kali', name: 'Keceh Kali (Bermain Sungai)', category: 'gratis', price: 0 },
  { id: 'berenang', name: 'Berenang', category: 'tiket', price: 5000 },
  { id: 'tangkap-ikan', name: 'Tangkap Ikan', category: 'aktivitas', price: 10000 },
  { id: 'tanam-padi', name: 'Tanam Padi', category: 'aktivitas', price: 15000 },
  { id: 'tanam-sayur', name: 'Tanam Sayur', category: 'aktivitas', price: 10000 },
  { id: 'cooking-class', name: 'Cooking Class', category: 'aktivitas', price: 25000 },
  { id: 'fun-game-2h', name: 'Fun Game (2 jam)', category: 'aktivitas', price: 15000 },
  { id: 'edukasi-gula-aren', name: 'Edukasi Pembuatan Gula Aren', category: 'aktivitas', price: 20000 },

  // Fishing
  { id: 'sewa-alat-pancing', name: 'Sewa Alat Pancing', category: 'fishing', price: 5000 },
  { id: 'pelet-umpan', name: 'Pelet Umpan', category: 'fishing', price: 5000 },
  { id: 'ikan-nila', name: 'Ikan Nila', category: 'fishing', price: 38000, note: '/kg' },
  { id: 'ikan-bawal', name: 'Ikan Bawal', category: 'fishing', price: 32000, note: '/kg' },
  { id: 'ikan-kalper', name: 'Ikan Kalper', category: 'fishing', price: 38000, note: '/kg' },

  // Sewa Tempat & Aula
  { id: 'pendopo', name: 'Pendopo (kap. 90-100 org)', category: 'sewa-tempat', price: 100000, note: '/jam' },
  { id: 'pendopo-besar', name: 'Pendopo Besar (kap. 40-50 org)', category: 'sewa-tempat', price: 75000, note: '/jam' },
  { id: 'gazebo-bawah', name: 'Gazebo Bawah (kap. 20-25 org)', category: 'sewa-tempat', price: 30000, note: '/jam' },
  { id: 'gazebo', name: 'Gazebo (kap. 30-40 org)', category: 'sewa-tempat', price: 50000, note: '/jam' },
  { id: 'aula-dalam', name: 'Aula Dalam (kap. 35-40 org)', category: 'sewa-tempat', price: 75000, note: '/jam' },
  { id: 'aula-teras', name: 'Aula Teras (kap. 35-40 org)', category: 'sewa-tempat', price: 75000, note: '/jam' },
  { id: 'aula-full', name: 'Aula Full (kap. 60-80 org)', category: 'sewa-tempat', price: 200000, note: '/jam' },
  { id: 'aula-sungai', name: 'Aula Sungai (kap. 70-90 org)', category: 'sewa-tempat', price: 100000, note: '/jam' },
  { id: 'outbound', name: 'Outbound', category: 'sewa-tempat', price: 25000, note: '/jam' },
  { id: 'senam', name: 'Senam', category: 'sewa-tempat', price: 25000, note: '/acara' },

  // Camping
  { id: 'htm-camp', name: 'HTM Camp', category: 'camping', price: 5000, note: '/orang' },
  { id: 'spot-tenda', name: 'Spot Tenda', category: 'camping', price: 25000 },
  { id: 'spot-tenda-besar', name: 'Spot Tenda Besar', category: 'camping', price: 40000 },
  { id: 'tenda-4', name: 'Tenda Kapasitas 4 Orang', category: 'camping', price: 75000 },

  // Homestay
  { id: 'homestay-1', name: 'Aren 1 (2-5 org)', category: 'homestay', price: 200000, maxPrice: 300000 },
  { id: 'homestay-2', name: 'Aren 2 (2-5 org)', category: 'homestay', price: 200000, maxPrice: 300000 },
  { id: 'homestay-3', name: 'Aren 3 (6-8 org)', category: 'homestay', price: 375000, maxPrice: 500000 },
  { id: 'homestay-4', name: 'Aren 4 (8-10 org)', category: 'homestay', price: 450000, maxPrice: 575000 },
  { id: 'extra-bed', name: 'Extra Bed (100x220)', category: 'homestay', price: 25000 },
  { id: 'over-kapasitas', name: 'Over Kapasitas', category: 'homestay', price: 10000, note: '/orang' },

  // Paket Edukasi
  { id: 'edutrip-1', name: 'Edu Trip Kesek 1', category: 'paket-edukasi', price: 35000, note: '/pax' },
  { id: 'edutrip-2', name: 'Edu Trip Kesek 2', category: 'paket-edukasi', price: 35000, note: '/pax' },
  { id: 'edutrip-3', name: 'Edu Trip Kesek 3', category: 'paket-edukasi', price: 50000, note: '/pax' },
  { id: 'edutrip-4', name: 'Edu Trip Kesek 4', category: 'paket-edukasi', price: 50000, note: '/pax' },
  { id: 'edutrip-5', name: 'Edu Trip Kesek 5', category: 'paket-edukasi', price: 80000, note: '/pax' },
  { id: 'package-1', name: 'Package Edukasi 1', category: 'paket-edukasi', price: 90000, note: '/pax - HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Lunch + Welcome drink' },
  { id: 'package-2', name: 'Package Edukasi 2', category: 'paket-edukasi', price: 100000, note: '/pax - HTM + Keceh Kali + Terapi Ikan + Fun Game + Lunch + Welcome drink' },
  { id: 'package-3', name: 'Package Edukasi 3', category: 'paket-edukasi', price: 120000, note: '/pax - HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Fun Game + Lunch + Welcome drink' },
]

export default function BookingWisataPage() {
  const [activeCategory, setActiveCategory] = useState('semua')
  const [cart, setCart] = useState<BookingItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredItems = activeCategory === 'semua'
    ? items
    : items.filter((item) => item.category === activeCategory)
  const activeCategoryInfo = getServiceCategory(activeCategory)

  const addItem = (item: typeof items[0]) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.id === item.id)
      if (existing) {
        return prev.map((ci) =>
          ci.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const updateCartItem = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((ci) => ci.id !== id))
      return
    }
    setCart((prev) =>
      prev.map((ci) => (ci.id === id ? { ...ci, quantity } : ci))
    )
  }

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName || !customerPhone || !bookingDate) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'wisata',
          customerName,
          customerPhone,
          customerEmail,
          bookingDate,
          notes,
          items: cart.map((ci) => ({
            id: ci.id,
            name: ci.name,
            quantity: ci.quantity,
            price: ci.price,
          })),
          totalAmount: totalPrice,
        }),
      })

      const data = await res.json()

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        window.location.href = `/booking/sukses?id=${data.bookingId}`
      }
    } catch (error) {
      alert('Gagal memproses booking. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Hero
        title="Booking Wisata"
        subtitle="Pilih aktivitas, paket edukasi, sewa tempat, atau homestay"
        image="/images/village-hero.jpg"
        height="sm"
      />

      <Section className="relative overflow-hidden">
        <CategoryVisualHeader category={activeCategoryInfo} />

        <div className="flex flex-wrap gap-2 mb-6">
          {serviceCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              aria-pressed={activeCategory === category.id}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-12">
          {filteredItems.map((item) => {
            const itemCategory = getServiceCategory(item.category)
            return (
              <div
                key={item.id}
                className="card flex items-center justify-between gap-2 bg-cover bg-center p-4"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.94)), url(${itemCategory.image})`,
                  backgroundPosition: itemCategory.position || 'center',
                }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm font-medium text-emerald-700">
                    {item.price === 0 ? 'Gratis' : formatPrice(item.price)}
                    {item.maxPrice && ` - ${formatPrice(item.maxPrice)}`}
                    {item.note && <span className="ml-0.5 text-xs text-gray-500">{item.note}</span>}
                  </p>
                </div>
                <button
                  onClick={() => addItem(item)}
                  aria-label={`Tambahkan ${item.name}`}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white transition hover:bg-emerald-700"
                >
                  +
                </button>
              </div>
            )
          })}
        </div>

        {cart.length > 0 && (
          <div className="card mx-auto max-w-2xl p-4 sm:p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Pesanan Anda ({cart.length} item)
            </h3>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 self-end min-[380px]:ml-2 min-[380px]:self-auto">
                    <button
                      onClick={() => updateCartItem(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm"
                    >
                      -
                    </button>
                    <span className="font-medium w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItem(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-xl text-emerald-600">
                  {formatPrice(totalPrice)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Check-in: 14.00 | Check-out: 12.00</p>
            </div>

            {!showForm ? (
              <button onClick={() => setShowForm(true)} className="btn-primary w-full">
                Lanjutkan ke Data Diri
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
                <div>
                  <label className="form-label">Nama Lengkap *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">No. WhatsApp *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="628xxx"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Tanggal Booking *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Catatan (opsional)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Jam datang, kebutuhan khusus, dll."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : `Bayar ${formatPrice(totalPrice)}`}
                </button>
              </form>
            )}
          </div>
        )}

        {cart.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Belum ada item dipilih</p>
            <p className="text-sm">Silakan pilih aktivitas, paket, atau sewa tempat di atas</p>
          </div>
        )}
      </Section>
    </>
  )
}
