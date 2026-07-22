'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'
import { formatPrice } from '@/lib/utils'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

function CheckoutForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  let cart: CartItem[] = []
  try {
    const itemsParam = searchParams.get('items')
    if (itemsParam) {
      cart = JSON.parse(decodeURIComponent(itemsParam))
    }
  } catch {
    cart = []
  }

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName || !customerPhone) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'toko',
          customerName,
          customerPhone,
          customerEmail,
          notes: `Alamat: ${address}`,
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
        router.push(`/booking/sukses?id=${data.bookingId}`)
      }
    } catch {
      alert('Gagal memproses pesanan. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Keranjang kosong</p>
          <a href="/toko" className="btn-primary mt-4 inline-block">
            Kembali ke Toko
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Pesanan Anda</h2>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.name} x{item.quantity}
                </span>
                <span className="font-medium">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 flex justify-between">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-lg text-emerald-600">
              {formatPrice(totalPrice)}
            </span>
          </div>
        </div>

        <form onSubmit={handleCheckout} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 mb-4">Data Diri</h2>

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
            <label className="form-label">Alamat Pengiriman</label>
            <textarea
              className="form-input"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat lengkap untuk pengiriman"
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
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" /></div>}>
      <CheckoutForm />
    </Suspense>
  )
}
