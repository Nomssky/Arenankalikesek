'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import AdminModal from '@/components/admin/AdminModal'

interface Product {
  id: string
  name: string
  price: number
  category: string
  image: string
  description: string
  unit: string
  available: boolean
  sort_order: number
}

const emptyProduct = {
  name: '',
  price: 0,
  category: 'paket-makanan',
  image: '',
  description: '',
  unit: 'paket',
  available: true,
  sort_order: 0,
}

const categories = [
  'paket-makanan',
  'pupuk',
  'fishing',
  'oleh-oleh',
]

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/products')
      if (res.ok) setProducts(await res.json())
      else setError('Gagal memuat produk')
    } catch (e) {
      console.error(e)
      setError('Gagal memuat produk')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(emptyProduct)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(product: Product) {
    setForm({
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image,
      description: product.description,
      unit: product.unit,
      available: product.available,
      sort_order: product.sort_order,
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const url = editingId
      ? `/api/admin/products/${editingId}`
      : '/api/admin/products'
    const method = editingId ? 'PATCH' : 'POST'

    setSaveError('')
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setShowForm(false)
        fetchProducts()
      } else {
        const data = await res.json()
        setSaveError(data.error || 'Gagal menyimpan')
      }
    } catch (e) {
      console.error(e)
      setSaveError('Gagal menyimpan produk')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus produk ini?')) return
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) fetchProducts()
      else setError('Gagal menghapus produk')
    } catch (e) {
      console.error(e)
      setError('Gagal menghapus produk')
    }
  }

  return (
    <div>
      <div className="admin-page-header flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Produk Toko</h1>
        <button onClick={openCreate} className="btn-primary text-sm">
          + Tambah Produk
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <AdminModal
          title={editingId ? 'Edit Produk' : 'Tambah Produk'}
          onClose={() => setShowForm(false)}
        >
            <form onSubmit={handleSave} className="space-y-3">
              {saveError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}
              <div>
                <label className="form-label">Nama</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Harga (Rp)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Kategori</label>
                <select
                  className="form-input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Deskripsi</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Gambar (path)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="/images/produk.jpg"
                />
              </div>
              <div>
                <label className="form-label">Satuan</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="kg, paket, botol"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                />
                <label htmlFor="available" className="form-label !mb-0">
                  Tersedia
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-outline flex-1"
                >
                  Batal
                </button>
              </div>
            </form>
        </AdminModal>
      )}

      {/* Table */}
      <div
        className="admin-table-scroll mt-4 rounded-xl bg-white shadow-sm"
        data-lenis-prevent
        data-scroll-container
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium">{error}</p>
          </div>
        ) : products.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Belum ada produk</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Kategori</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Harga</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Satuan</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tersedia</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category}</td>
                  <td className="px-4 py-3 text-gray-900">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {p.available ? 'Ya' : 'Tidak'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
