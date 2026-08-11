'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense, useEffect } from 'react'
import { formatPrice } from '@/lib/utils'
import { addPendingBookingId, removePendingBookingId } from '@/lib/pending-bookings'
import PaymentWaitingModal, { type PaymentWaitingData } from '@/components/PaymentWaitingModal'

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

interface ProductPrice {
  id: string
  name: string
  price: number
  purchasable: boolean
}

function CheckoutForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartReady, setCartReady] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [waitingPayment, setWaitingPayment] = useState<PaymentWaitingData | null>(null)

  const itemsParam = searchParams.get('items')

  useEffect(() => {
    let cancelled = false
    async function loadCurrentCart() {
      try {
        const storedCart = itemsParam
          ? decodeURIComponent(itemsParam)
          : sessionStorage.getItem('toko-cart')
        const storedItems: CartItem[] = storedCart ? JSON.parse(storedCart) : []
        const response = await fetch('/api/products?available=true')
        if (!response.ok) throw new Error('Gagal memuat harga produk terbaru')
        const products = await response.json() as ProductPrice[]
        if (cancelled) return
        setCart(storedItems.flatMap((cartItem) => {
          const product = products.find((item) => item.id === cartItem.id && item.purchasable)
          return product ? [{
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: cartItem.quantity,
          }] : []
        }))
      } catch {
        if (!cancelled) {
          setCart([])
          setCatalogError('Harga produk terbaru tidak dapat dimuat. Silakan kembali ke toko dan coba lagi.')
        }
      } finally {
        if (!cancelled) setCartReady(true)
      }
    }
    void loadCurrentCart()

    return () => {
      cancelled = true
    }
  }, [itemsParam])

const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleContinuePayment = async (data: PaymentWaitingData) => {
    setSubmitError('')
    try {
      const phone = sessionStorage.getItem(`invoice_phone_${data.bookingId}`) || ''
      const res = await fetch(`/api/bookings/${data.bookingId}/payment?phone=${encodeURIComponent(phone)}`)
      const status = await res.json()
      if (!res.ok) {
        setSubmitError(status.error || 'Gagal memeriksa status pembayaran')
        return
      }
      if (status.state === 'paid') {
        router.push(`/booking/sukses?id=${data.bookingId}`)
        return
      }
      if (status.state !== 'pending' || !status.canResume) {
        setWaitingPayment({
          ...data,
          state: status.state,
          paymentUrl: status.paymentUrl || null,
          snapToken: status.snapToken || null,
          expiresAt: status.expiresAt || null,
        })
        return
      }
      if (status.snapToken) {
        await loadSnapJs()
        if (window.snap) {
          window.snap.pay(status.snapToken, {
            onSuccess: () => router.push(`/booking/sukses?id=${data.bookingId}`),
            onPending: () => setWaitingPayment(null),
            onError: () => setWaitingPayment(null),
            onClose: () => setWaitingPayment(null),
          })
          return
        }
      }
      if (status.paymentUrl) {
        window.location.assign(status.paymentUrl)
        return
      }
      setWaitingPayment({
        ...data,
        state: status.state,
        paymentUrl: status.paymentUrl || null,
        snapToken: status.snapToken || null,
        expiresAt: status.expiresAt || null,
      })
    } catch {
      setSubmitError('Gagal melanjutkan pembayaran. Silakan coba lagi.')
    }
  }

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
      try {
        sessionStorage.setItem(`invoice_phone_${data.bookingId}`, customerPhone.trim())
      } catch {}
      const waitingData: PaymentWaitingData = {
        bookingId: data.bookingId,
        bookingCode: data.bookingCode || null,
        totalAmount: Number(data.totalAmount ?? totalPrice),
        paymentUrl: data.paymentUrl || null,
        snapToken: data.snapToken || null,
        serviceName: cart.map((ci) => ci.name).join(', ') || null,
        bookingDate: null,
        timeStart: null,
        timeEnd: null,
        expiresAt: data.expiresAt || null,
        state: data.status === 'pending' ? 'pending' : null,
      }
      try { sessionStorage.removeItem('toko-cart') } catch {}

      if (data.snapToken) {
        await loadSnapJs()
        if (!window.snap) {
          addPendingBookingId(data.bookingId)
          setWaitingPayment(waitingData)
          return
        }
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            removePendingBookingId(data.bookingId)
            router.push(`/booking/sukses?id=${data.bookingId}`)
          },
          onPending: () => {
            addPendingBookingId(data.bookingId)
            setWaitingPayment(waitingData)
          },
          onError: () => {
            addPendingBookingId(data.bookingId)
            setWaitingPayment(waitingData)
          },
          onClose: () => {
            addPendingBookingId(data.bookingId)
            setWaitingPayment(waitingData)
          },
        })
      } else if (data.paymentUrl) {
        addPendingBookingId(data.bookingId)
        window.location.assign(data.paymentUrl)
      } else if (data.status === 'pending') {
        addPendingBookingId(data.bookingId)
        setWaitingPayment(waitingData)
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
          <p className={`text-lg ${catalogError ? 'text-red-600' : 'text-gray-500'}`}>
            {catalogError || 'Keranjang kosong'}
          </p>
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
              aria-label="Nama lengkap"
              maxLength={120}
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
              aria-label="Nomor WhatsApp"
              inputMode="tel"
              pattern="(?:\+?62|0)8[0-9 -]{8,15}"
              title="Gunakan nomor WhatsApp Indonesia, misalnya 0812 3456 7890"
              maxLength={20}
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
              aria-label="Email"
              maxLength={254}
              className="form-input"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
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
<PaymentWaitingModal
        data={waitingPayment}
        onClose={() => setWaitingPayment(null)}
        onContinuePayment={handleContinuePayment}
        onLater={() => setWaitingPayment(null)}
      />
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
