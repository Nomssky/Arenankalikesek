'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  max_price: number | null
  capacity: string | null
  quantity: number
  note: string | null
}

interface TourPackage {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  capacity: string | null
  note: string | null
}

export default function BookingWisataPage() {
  const router = useRouter()
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('semua')
  const [cart, setCart] = useState<BookingItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [eventName, setEventName] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (redirectUrl) {
      window.location.href = redirectUrl
    }
  }, [redirectUrl])

  useEffect(() => {
    async function fetchPackages() {
      try {
        const res = await fetch('/api/tour-packages?available=true')
        if (res.ok) {
          const data = await res.json()
          setPackages(data)
        } else {
          setFetchError('Gagal memuat paket wisata')
        }
      } catch (e) {
        console.error('Failed to load packages:', e)
        setFetchError('Gagal memuat paket wisata')
      } finally {
        setLoading(false)
      }
    }
    fetchPackages()
  }, [])

  const filteredItems = activeCategory === 'semua'
    ? packages
    : packages.filter((item) => item.category === activeCategory)
  const activeCategoryInfo = getServiceCategory(activeCategory)

  const addItem = (item: TourPackage) => {
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

    setSubmitError('')
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
          customerAddress,
          eventName: eventName || undefined,
          bookingDate,
          timeStart: timeStart || undefined,
          timeEnd: timeEnd || undefined,
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

      if (!res.ok) {
        setSubmitError(data.error || 'Gagal memproses booking')
        return
      }

      if (data.paymentUrl) {
        setRedirectUrl(data.paymentUrl)
      } else {
        router.push(`/booking/sukses?id=${data.bookingId}`)
      }
    } catch {
      setSubmitError('Gagal memproses booking. Silakan coba lagi.')
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

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : fetchError ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700 mb-12">
            <p className="text-lg font-medium mb-1">{fetchError}</p>
            <button onClick={() => window.location.reload()} className="text-sm text-red-600 underline">
              Coba lagi
            </button>
          </div>
        ) : (
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
                    {item.max_price && ` - ${formatPrice(item.max_price)}`}
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
        )}

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
                {submitError && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}
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
                  <label className="form-label">Alamat</label>
                  <input
                    type="text"
                    className="form-input"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Alamat lengkap"
                  />
                </div>
                <div>
                  <label className="form-label">Nama Acara (opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Misal: Arisan Keluarga, Meeting"
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Jam Mulai</label>
                    <input
                      type="time"
                      className="form-input"
                      value={timeStart}
                      onChange={(e) => setTimeStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Jam Selesai</label>
                    <input
                      type="time"
                      className="form-input"
                      value={timeEnd}
                      onChange={(e) => setTimeEnd(e.target.value)}
                    />
                  </div>
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
