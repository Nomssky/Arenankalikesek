'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense, useEffect } from 'react'
import { formatPrice } from '@/lib/utils'

function loadSnapJs(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.snap !== 'undefined') { resolve(); return }
    const script = document.createElement('script')
    script.src = `${process.env.NEXT_PUBLIC_MIDTRANS_API_URL || 'https://app.sandbox.midtrans.com'}/snap/snap.js`
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.body.appendChild(script)
  })
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks: {
        onSuccess?: () => void
        onPending?: () => void
        onError?: () => void
        onClose?: () => void
      }) => void
    }
  }
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

function CheckoutForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartReady, setCartReady] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const itemsParam = searchParams.get('items')

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return

      try {
        const storedCart = itemsParam
          ? decodeURIComponent(itemsParam)
          : sessionStorage.getItem('toko-cart')
        setCart(storedCart ? JSON.parse(storedCart) : [])
      } catch {
        setCart([])
      } finally {
        setCartReady(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [itemsParam])

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName || !customerPhone) return

    setSubmitError('')
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
          customerAddress: address || undefined,
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
        setSubmitError(data.error || 'Gagal memproses pesanan')
        return
      }

      if (data.booking) {
        localStorage.setItem(`invoice_${data.bookingId}`, JSON.stringify(data.booking))
      }
      try { sessionStorage.removeItem('toko-cart') } catch {}

      if (data.snapToken) {
        await loadSnapJs()
        window.snap!.pay(data.snapToken, {
          onSuccess: () => { router.push(`/booking/sukses?id=${data.bookingId}`) },
          onPending: () => { router.push(`/booking/sukses?id=${data.bookingId}`) },
          onError: () => { setSubmitError('Pembayaran gagal, silakan hubungi admin') },
          onClose: () => {},
        })
      } else if (data.paymentUrl) {
        window.location.assign(data.paymentUrl)
      } else {
        router.push(`/booking/sukses?id=${data.bookingId}`)
      }
    } catch {
      setSubmitError('Gagal memproses pesanan. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!cartReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    )
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
    <div className="min-h-screen bg-[#f3f0e6] pb-12 pt-28">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="mb-6 text-2xl font-bold text-gray-900 sm:mb-8">Checkout</h1>

        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Pesanan Anda</h2>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                <span className="min-w-0 break-words text-gray-600">
                  {item.name} x{item.quantity}
                </span>
                <span className="shrink-0 font-medium">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t pt-4">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-lg text-emerald-600">
              {formatPrice(totalPrice)}
            </span>
          </div>
        </div>

        <form onSubmit={handleCheckout} className="space-y-4 rounded-xl bg-white p-4 shadow-sm sm:p-6">
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

          {submitError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
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
