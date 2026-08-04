'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import AdminModal from '@/components/admin/AdminModal'

interface InventoryItem {
  id: string
  name: string
  category: string
  price_per_unit: number
  description: string | null
  available: boolean
}

const emptyItem = {
  name: '',
  category: 'tempat-pertemuan',
  price_per_unit: 0,
  description: '',
  available: true,
}

const categories = ['area-kegiatan', 'tempat-pertemuan', 'homestay', 'camping', 'fishing']

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyItem)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/inventory')
      if (res.ok) setItems(await res.json())
      else setError('Gagal memuat inventory')
    } catch (e) {
      console.error(e)
      setError('Gagal memuat inventory')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(emptyItem)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(item: InventoryItem) {
    setForm({
      name: item.name,
      category: item.category,
      price_per_unit: item.price_per_unit,
      description: item.description || '',
      available: item.available,
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const url = editingId
      ? `/api/admin/inventory/${editingId}`
      : '/api/admin/inventory'
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
        fetchItems()
      } else {
        const data = await res.json()
        setSaveError(data.error || 'Gagal menyimpan')
      }
    } catch (e) {
      console.error(e)
      setSaveError('Gagal menyimpan item')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus item ini?')) return
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, { method: 'DELETE' })
      if (res.ok) fetchItems()
      else setError('Gagal menghapus item')
    } catch (e) {
      console.error(e)
      setError('Gagal menghapus item')
    }
  }

  return (
    <div>
      <div className="admin-page-header flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Rental</h1>
        <button onClick={openCreate} className="btn-primary text-sm">
          + Tambah Item
        </button>
      </div>

      {showForm && (
        <AdminModal
          title={editingId ? 'Edit Item' : 'Tambah Item'}
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
                <label className="form-label">Harga (Rp)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.price_per_unit}
                  onChange={(e) => setForm({ ...form, price_per_unit: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Deskripsi</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Kapasitas 2-5 orang"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available-inv"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                />
                <label htmlFor="available-inv" className="form-label !mb-0">
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
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Belum ada item</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Kategori</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Harga</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Deskripsi</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tersedia</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-gray-900">{formatPrice(item.price_per_unit)}</td>
                  <td className="px-4 py-3 text-gray-500">{item.description || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.available ? 'Ya' : 'Tidak'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
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
