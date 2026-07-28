'use client'

import { useEffect, useRef, useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import CartToast from '@/components/CartToast'
import { formatPrice } from '@/lib/utils'
import {
  CheckIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface Product {
  id: string
  name: string
  price: number
  price_label: string
  category: string
  image: string
  description: string
  unit: string
  purchasable: boolean
}

const categories = [
  { id: 'semua', name: 'Semua' },
  { id: 'paket-makanan', name: 'Paket Menu Makanan' },
]

export default function TokoPage() {
  const toastTimerRef = useRef<number | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartReady, setCartReady] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [toastProduct, setToastProduct] = useState<Product | null>(null)
  const [activeCategory, setActiveCategory] = useState('semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      try {
        const storedCart = sessionStorage.getItem('toko-cart')
        if (storedCart) setCart(JSON.parse(storedCart))
      } catch {
        sessionStorage.removeItem('toko-cart')
      } finally {
        setCartReady(true)
      }
    })

    return () => {
      cancelled = true
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!cartReady) return
    sessionStorage.setItem('toko-cart', JSON.stringify(cart))
  }, [cart, cartReady])

  useEffect(() => {
    if (!showCart) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowCart(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [showCart])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const data: Product[] = await res.json()
          setProducts(data)
          setCart((currentCart) =>
            currentCart.flatMap((cartItem) => {
              const product = data.find((item) => item.id === cartItem.id)
              return product?.purchasable
                ? [
                    {
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      quantity: cartItem.quantity,
                    },
                  ]
                : []
            })
          )
        } else {
          setError('Gagal memuat produk')
        }
      } catch (e) {
        console.error('Failed to load products:', e)
        setError('Gagal memuat produk')
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const filteredProducts = products.filter((p) => {
    const matchCategory = activeCategory === 'semua' || p.category === activeCategory
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  const addToCart = (product: Product) => {
    if (!product.purchasable) return
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
    setToastProduct(product)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastProduct(null), 4200)
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id))
      return
    }
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    )
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const openCart = () => {
    setToastProduct(null)
    setShowCart(true)
  }

  return (
    <>
      <Hero title="Toko Arenan Kalikesek" subtitle="Belanja produk khas Kalikesek" image="/images/village-tradition.jpg" height="sm" />

      <Section>
        <div className="mb-8 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
            <input
              type="text"
              placeholder="Cari produk..."
              className="form-input min-w-0 flex-1 text-base sm:w-48 sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="button"
              onClick={openCart}
              className="btn-primary relative shrink-0 text-sm"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              <span className="hidden min-[420px]:inline">Keranjang</span>
              {totalItems > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium mb-1">{error}</p>
            <button onClick={() => window.location.reload()} className="text-sm text-red-600 underline">
              Coba lagi
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Produk tidak ditemukan</p>
            <p className="text-sm">Coba ubah kata kunci atau kategori</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const selectedQuantity =
                cart.find((item) => item.id === product.id)?.quantity || 0

              return (
              <article
                key={product.id}
                className={`card motion-card group ${selectedQuantity > 0 ? 'ring-2 ring-emerald-500/25' : ''}`}
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-emerald-50 to-amber-50 flex items-center justify-center overflow-hidden relative">
                  <div
                    className="w-full h-full bg-cover bg-center group-hover:scale-[1.03] transition-transform duration-300"
                    style={{ backgroundImage: `url(${product.image})` }}
                  >
                    <div className="h-full w-full bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <span className="absolute top-2 right-2 text-xs bg-white/90 px-2 py-1 rounded-full font-medium text-gray-600">
                    {product.unit}
                  </span>
                  {selectedQuantity > 0 && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow">
                      <CheckIcon className="h-3.5 w-3.5" />
                      Di keranjang {selectedQuantity}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                  </div>
                    <p className="text-xs text-gray-500 mb-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-emerald-600">{product.price_label}</p>
                    {product.purchasable ? (
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        aria-label={`Tambahkan ${product.name} ke keranjang`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 active:scale-95"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Tambah
                      </button>
                    ) : (
                      <a
                        href={`https://wa.me/6285741171957?text=${encodeURIComponent(`Halo, saya ingin menanyakan harga ${product.name}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center rounded-full bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
                      >
                        Hubungi Pengelola
                      </a>
                    )}
                  </div>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </Section>

      {cart.length > 0 && (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-2xl bg-emerald-900 px-4 py-3.5 text-left text-white shadow-[0_18px_55px_-18px_rgba(6,78,59,0.8)] transition hover:bg-emerald-800 sm:left-auto sm:right-6 sm:w-auto sm:min-w-80 sm:translate-x-0"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
              <ShoppingCartIcon className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold">
                {totalItems}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-white/65">Keranjang belanja</span>
              <span className="block truncate text-sm font-semibold">Lihat & checkout</span>
            </span>
          </span>
          <strong className="shrink-0 text-sm">{formatPrice(totalPrice)}</strong>
        </button>
      )}

      {toastProduct && (
        <CartToast
          title="Produk ditambahkan"
          message={`${toastProduct.name} sudah masuk ke keranjang belanja.`}
          actionLabel="Lihat keranjang"
          onAction={openCart}
          onClose={() => setToastProduct(null)}
        />
      )}

      {showCart && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-emerald-950/55 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCart(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keranjang belanja"
            data-lenis-prevent
            data-scroll-container
            className="max-h-[calc(100dvh-1rem)] w-full overflow-auto rounded-t-[1.75rem] bg-white p-5 sm:max-h-[82vh] sm:max-w-xl sm:rounded-[1.75rem] sm:p-7"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                <ShoppingCartIcon className="h-6 w-6 text-emerald-700" />
                Keranjang
              </h3>
              <button
                type="button"
                onClick={() => setShowCart(false)}
                aria-label="Tutup keranjang"
                className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Keranjang kosong</p>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatPrice(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end min-[380px]:self-auto">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label={`Kurangi ${item.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 transition hover:bg-gray-300"
                        >
                          <MinusIcon className="h-4 w-4" />
                        </button>
                        <span className="font-medium w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label={`Tambah ${item.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 transition hover:bg-gray-300"
                        >
                          <PlusIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 0)}
                          aria-label={`Hapus ${item.name}`}
                          className="ml-1 rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-xl text-emerald-600">{formatPrice(totalPrice)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem('toko-cart', JSON.stringify(cart))
                      setShowCart(false)
                      window.location.href = '/toko/checkout'
                    }}
                    className="btn-primary w-full"
                  >
                    Checkout {totalItems} barang
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
