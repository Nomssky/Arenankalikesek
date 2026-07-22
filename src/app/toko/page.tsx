'use client'

import { useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'
import { formatPrice } from '@/lib/utils'

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
  desc: string
  unit: string
}

const categories = [
  { id: 'semua', name: 'Semua' },
  { id: 'paket-makanan', name: '🍽️ Paket Makanan' },
  { id: 'pupuk', name: '🌱 Pupuk & Pertanian' },
  { id: 'fishing', name: '🎣 Fishing' },
  { id: 'oleh-oleh', name: '🎁 Oleh-oleh' },
]

const products: Product[] = [
  // 🍽️ Paket Makanan
  { id: 'paket-makan-1', name: 'Paket Makan 1', price: 8000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Gudeg + Gorengan', unit: 'paket' },
  { id: 'paket-makan-2', name: 'Paket Makan 2', price: 9000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Soto + Gorengan', unit: 'paket' },
  { id: 'paket-makan-3', name: 'Paket Makan 3', price: 12000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Gudeg + Telur + Ayam Kampung + Kerupuk', unit: 'paket' },
  { id: 'paket-makan-4', name: 'Paket Makan 4', price: 15000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Ayam Goreng + Sambal + Lalapan', unit: 'paket' },
  { id: 'paket-makan-5', name: 'Paket Makan 5', price: 15000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Ayam Geprek', unit: 'paket' },
  { id: 'paket-makan-6', name: 'Paket Makan 6', price: 17000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Ayam Goreng + Sambal + Lalapan', unit: 'paket' },
  { id: 'paket-makan-7', name: 'Paket Makan 7', price: 22000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Ayam Kampung + Sambal + Lalapan', unit: 'paket' },
  { id: 'paket-makan-8', name: 'Paket Makan 8', price: 25000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Ikan Bakar + Sambal + Lalapan', unit: 'paket' },
  { id: 'paket-makan-9', name: 'Paket Makan 9', price: 25000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Ayam Bakar + Sambal + Lalapan', unit: 'paket' },
  { id: 'paket-makan-10', name: 'Paket Makan 10', price: 30000, category: 'paket-makanan', image: '/images/paket-makan.jpg', desc: 'Nasi + Iga Bakar + Sambal + Lalapan', unit: 'paket' },
  // 🌱 Pupuk & Pertanian
  { id: 'pupuk-kompos', name: 'Pupuk Kompos', price: 25000, category: 'pupuk', image: '/images/pupuk-kompos.jpg', desc: 'Pupuk kompos organik', unit: 'karung' },
  { id: 'pupuk-cair', name: 'Pupuk Cair Organik', price: 15000, category: 'pupuk', image: '/images/pupuk-cair.jpg', desc: 'Pupuk cair untuk tanaman', unit: 'botol' },
  // 🎣 Fishing
  { id: 'sewa-alat-pancing', name: 'Sewa Alat Pancing', price: 5000, category: 'fishing', image: '/images/sewa-pancing.jpg', desc: 'Sewa alat pancing lengkap', unit: 'set' },
  { id: 'pelet-umpan', name: 'Pelet Umpan', price: 5000, category: 'fishing', image: '/images/pelet.jpg', desc: 'Pelet umpan ikan berkualitas', unit: 'bungkus' },
  { id: 'ikan-nila', name: 'Ikan Nila Segar', price: 38000, category: 'fishing', image: '/images/ikan-nila.jpg', desc: 'Ikan nila segar', unit: 'kg' },
  { id: 'ikan-bawal', name: 'Ikan Bawal Segar', price: 32000, category: 'fishing', image: '/images/ikan-bawal.jpg', desc: 'Ikan bawal segar', unit: 'kg' },
  { id: 'ikan-kalper', name: 'Ikan Kalper Segar', price: 38000, category: 'fishing', image: '/images/ikan-kalper.jpg', desc: 'Ikan kalper segar', unit: 'kg' },
  // 🎁 Oleh-oleh
  { id: 'gula-aren', name: 'Gula Aren Murni', price: 35000, category: 'oleh-oleh', image: '/images/gula-aren.jpg', desc: 'Gula aren asli 100% alami', unit: 'kg' },
]

export default function TokoPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [activeCategory, setActiveCategory] = useState('semua')
  const [searchQuery, setSearchQuery] = useState('')

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

  const categoryIcons: Record<string, string> = {
    'paket-makanan': '🍽️',
    pupuk: '🌱',
    fishing: '🎣',
    'oleh-oleh': '🎁',
  }

  return (
    <>
      <Hero title="Toko Arenan Kalikesek" subtitle="Belanja produk khas Kalikesek" height="sm" />

      <Section>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.id !== 'semua' && categoryIcons[cat.id]} {cat.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Cari produk..."
              className="form-input text-sm flex-1 sm:w-48"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              onClick={() => setShowCart(!showCart)}
              className="btn-primary text-sm relative"
            >
              🛒 {totalItems}
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
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
                    <div className="w-full h-full bg-white/40 flex items-center justify-center">
                      <span className="text-5xl opacity-60">
                        {product.category === 'paket-makanan' ? '🍽️' : product.category === 'pupuk' ? '🌱' : product.category === 'fishing' ? '🎣' : '🎁'}
                      </span>
                    </div>
                  </div>
                  <span className="absolute top-2 right-2 text-xs bg-white/90 px-2 py-1 rounded-full font-medium text-gray-600">
                    {product.unit}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{product.desc}</p>
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
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">🛒 Keranjang</h3>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Keranjang kosong</p>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatPrice(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
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
                      setShowCart(false)
                      window.location.href = `/toko/checkout?items=${encodeURIComponent(JSON.stringify(cart))}`
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
