'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import AdminModal from '@/components/admin/AdminModal'

interface TourPackage {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  capacity: string | null
  note: string | null
  image: string
  available: boolean
  sort_order: number
}

const emptyPackage = {
  name: '',
  category: 'tiket',
  price: 0,
  max_price: null as number | null,
  capacity: '',
  note: '',
  image: '',
  available: true,
  sort_order: 0,
}

const categories = [
  'tiket',
  'gratis',
  'aktivitas',
  'sewa-tempat',
  'camping',
  'glamping',
  'homestay',
  'fishing',
  'paket-edukasi',
]

export default function AdminTourPackagesPage() {
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyPackage)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetchPackages()
  }, [])

  async function fetchPackages() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tour-packages')
      if (res.ok) setPackages(await res.json())
      else setError('Gagal memuat paket wisata')
    } catch (e) {
      console.error(e)
      setError('Gagal memuat paket wisata')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(emptyPackage)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(pkg: TourPackage) {
    setForm({
      name: pkg.name,
      category: pkg.category,
      price: pkg.price,
      max_price: pkg.max_price,
      capacity: pkg.capacity || '',
      note: pkg.note || '',
      image: pkg.image || '',
      available: pkg.available,
      sort_order: pkg.sort_order,
    })
    setEditingId(pkg.id)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const url = editingId
      ? `/api/admin/tour-packages/${editingId}`
      : '/api/admin/tour-packages'
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
        fetchPackages()
      } else {
        const data = await res.json()
        setSaveError(data.error || 'Gagal menyimpan')
      }
    } catch (e) {
      console.error(e)
      setSaveError('Gagal menyimpan paket')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus paket ini?')) return
    try {
      const res = await fetch(`/api/admin/tour-packages/${id}`, { method: 'DELETE' })
      if (res.ok) fetchPackages()
      else setError('Gagal menghapus paket')
    } catch (e) {
      console.error(e)
      setError('Gagal menghapus paket')
    }
  }

  const categoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      tiket: 'Tiket',
      gratis: 'Gratis',
      aktivitas: 'Aktivitas',
      'sewa-tempat': 'Sewa Tempat',
      camping: 'Camping',
      glamping: 'Glamping',
      homestay: 'Homestay',
      fishing: 'Fishing',
      'paket-edukasi': 'Paket Edukasi',
    }
    return labels[cat] || cat
  }

  return (
    <div>
      <div className="admin-page-header flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Paket Wisata</h1>
        <button onClick={openCreate} className="btn-primary text-sm">
          + Tambah Paket
        </button>
      </div>

      {showForm && (
        <AdminModal
          title={editingId ? 'Edit Paket' : 'Tambah Paket'}
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
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
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
                <label className="form-label">Harga Max (Rp, opsional)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.max_price || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <label className="form-label">Kapasitas</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="6-8 org"
                />
              </div>
              <div>
                <label className="form-label">Catatan</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="/jam, /pax"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available-tp"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                />
                <label htmlFor="available-tp" className="form-label !mb-0">
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
        className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
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
        ) : packages.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Belum ada paket</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Kategori</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Harga</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Kapasitas</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Catatan</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aktif</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{categoryLabel(p.category)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {p.price === 0
                      ? 'Gratis'
                      : formatPrice(p.price)}
                    {p.max_price && ` - ${formatPrice(p.max_price)}`}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.capacity || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.note || '-'}</td>
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
