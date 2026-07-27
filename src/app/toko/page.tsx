'use client'

import { useEffect, useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { formatPrice } from '@/lib/utils'
import { ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/outline'

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
  category: string
  image: string
  description: string
  unit: string
}

const categories = [
  { id: 'semua', name: 'Semua' },
  { id: 'paket-makanan', name: 'Paket Makanan' },
  { id: 'pupuk', name: 'Pupuk & Pertanian' },
  { id: 'fishing', name: 'Fishing' },
  { id: 'oleh-oleh', name: 'Oleh-oleh' },
]

export default function TokoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [activeCategory, setActiveCategory] = useState('semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const data = await res.json()
          setProducts(data)
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
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
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
              onClick={() => setShowCart(!showCart)}
              className="btn-primary text-sm relative"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              {totalItems}
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
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
            {filteredProducts.map((product) => (
              <div key={product.id} className="card group">
                <div className="aspect-[4/3] bg-gradient-to-br from-emerald-50 to-amber-50 flex items-center justify-center overflow-hidden relative">
                  <div
                    className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                    style={{ backgroundImage: `url(${product.image})` }}
                  >
                    <div className="h-full w-full bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                  <span className="absolute top-2 right-2 text-xs bg-white/90 px-2 py-1 rounded-full font-medium text-gray-600">
                    {product.unit}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                  </div>
                    <p className="text-xs text-gray-500 mb-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-emerald-600 font-bold">{formatPrice(product.price)}</p>
                    <button
                      onClick={() => addToCart(product)}
                      className="w-8 h-8 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 flex items-center justify-center font-bold text-lg flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="max-h-[calc(100dvh-1rem)] w-full overflow-auto rounded-t-2xl bg-white p-4 sm:max-h-[80vh] sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                <ShoppingCartIcon className="h-6 w-6 text-emerald-700" />
                Keranjang
              </h3>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-xl">
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
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm"
                        >
                          -
                        </button>
                        <span className="font-medium w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 text-sm"
                        >
                          +
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
                    onClick={() => {
                      sessionStorage.setItem('toko-cart', JSON.stringify(cart))
                      setShowCart(false)
                      window.location.href = '/toko/checkout'
                    }}
                    className="btn-primary w-full"
                  >
                    Lanjut ke Checkout
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
