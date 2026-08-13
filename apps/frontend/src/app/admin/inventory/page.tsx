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
  capacity: string | null
  available: boolean
  created_at: string
}

const emptyItem = {
  name: '',
  category: 'tempat-pertemuan',
  price_per_unit: 0,
  description: '',
  capacity: '',
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
  const [sortOrder, setSortOrder] = useState<'terbaru' | 'terlama'>('terbaru')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/inventory')
      if (res.ok) setItems(await res.json())
      else setError('Gagal memuat stok barang')
    } catch (e) {
      console.error(e)
      setError('Gagal memuat stok barang')
    } finally {
      setLoading(false)
    }
  }

  const createdDate = (item: InventoryItem) => (item.created_at ? String(item.created_at).slice(0, 10) : '')

  const visibleItems = items
    .filter((item) => {
      const created = createdDate(item)
      if (startDate && created && created < startDate) return false
      if (endDate && created && created > endDate) return false
      return true
    })
    .sort((a, b) => {
      const first = createdDate(a)
      const second = createdDate(b)
      if (sortOrder === 'terlama') return first.localeCompare(second)
      return second.localeCompare(first)
    })

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
      capacity: item.capacity || '',
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
      setSaveError('Gagal menyimpan barang')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus barang ini?')) return
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, { method: 'DELETE' })
      if (res.ok) fetchItems()
      else setError('Gagal menghapus barang')
    } catch (e) {
      console.error(e)
      setError('Gagal menghapus barang')
    }
  }

  async function toggleAvailable(item: { id: string; available: boolean }) {
    try {
      const res = await fetch(`/api/admin/inventory/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !item.available }),
      })
      if (res.ok) fetchItems()
      else setError('Gagal mengubah status aktif')
    } catch (e) {
      console.error(e)
      setError('Gagal mengubah status aktif')
    }
  }

  return (
    <div>
      <div className="admin-page-header flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Stok Barang</h1>
        <button onClick={openCreate} className="btn-primary text-sm">
          + Tambah Barang
        </button>
      </div>

      <div className="admin-filterbar mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="form-label">Urutkan</label>
          <select
            className="form-input w-auto"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'terbaru' | 'terlama')}
            aria-label="Urutkan stok barang"
          >
            <option value="terbaru">Terbaru</option>
            <option value="terlama">Terlama</option>
          </select>
        </div>
        <label className="text-sm font-medium text-gray-700">
          Dari
          <input
            type="date"
            className="form-input mt-1 block w-auto"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Sampai
          <input
            type="date"
            className="form-input mt-1 block w-auto"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        {(startDate || endDate || sortOrder !== 'terbaru') && (
          <button
            type="button"
            onClick={() => { setStartDate(''); setEndDate(''); setSortOrder('terbaru') }}
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            Reset filter
          </button>
        )}
      </div>

      {showForm && (
        <AdminModal
          title={editingId ? 'Edit Barang' : 'Tambah Barang'}
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
                  placeholder="Aula dengan pemandangan sungai"
                />
              </div>
              <div>
                <label className="form-label">Kapasitas</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="35–40 orang"
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
        ) : visibleItems.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Belum ada barang</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Kategori</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Harga</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Deskripsi</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Ditambahkan</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tersedia</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.category}</td>
                  <td className="px-4 py-3 text-gray-900">{formatPrice(item.price_per_unit)}</td>
                  <td className="px-4 py-3 text-gray-500">{item.description || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {createdDate(item)
                      ? new Date(`${createdDate(item)}T00:00:00`).toLocaleDateString('id-ID')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      aria-pressed={item.available}
                      onClick={() => toggleAvailable(item)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                        item.available ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                      title={item.available ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          item.available ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
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
