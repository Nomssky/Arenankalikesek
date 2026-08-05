'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import AdminModal from '@/components/admin/AdminModal'

interface BookingRow {
  id: string
  booking_code: string
  type: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  event_name: string
  booking_date: string
  booking_mode: string
  check_in_date: string | null
  check_out_date: string | null
  nights: number | null
  guest_count: number | null
  document_type: string | null
  time_start: string
  time_end: string
  total_amount: number
  status: string
  payment_status: string
  payment_method: string
  payment_url: string
  assigned_pic: string
  notes: string
  created_at: string
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{ status: string; payment_status: string } | null>(null)
  const [savedData, setSavedData] = useState<Record<string, { status: string; payment_status: string }>>({})
  const [error, setError] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    type: 'wisata' as string,
    bookingDate: '',
    timeStart: '',
    timeEnd: '',
    itemsText: '',
    totalAmount: '',
    paymentStatus: 'paid' as string,
  })
  const [saveError, setSaveError] = useState('')

  async function openIdentityDocument(id: string) {
    setUpdateError('')
    try {
      const response = await fetch(`/api/admin/bookings/${id}/document`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal membuka dokumen')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (documentError) {
      setUpdateError(documentError instanceof Error ? documentError.message : 'Gagal membuka dokumen')
    }
  }

  async function deleteIdentityDocument(id: string) {
    if (!window.confirm('Hapus permanen dokumen identitas privat booking ini?')) return
    const response = await fetch(`/api/admin/bookings/${id}/document`, { method: 'DELETE' })
    if (response.ok) {
      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, document_type: null } : booking))
    } else {
      const data = await response.json()
      setUpdateError(data.error || 'Gagal menghapus dokumen')
    }
  }

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (paymentFilter) params.set('payment_status', paymentFilter)
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/bookings?${params}`)
      if (res.ok) {
        let data = await res.json()
        if (search) {
          const q = search.toLowerCase()
          data = data.filter(
              (b: BookingRow) =>
                b.customer_name.toLowerCase().includes(q) ||
                (b.customer_phone || '').includes(q) ||
              (b.booking_code && b.booking_code.toLowerCase().includes(q))
          )
        }
        setBookings(data)
      } else {
        setError('Gagal memuat booking')
      }
    } catch (e) {
      console.error(e)
      setError('Gagal memuat booking')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, paymentFilter, typeFilter, search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings()
  }, [fetchBookings])

  function isOnlineBooking(b: BookingRow) {
    return b.payment_method !== 'offline' && !(b.booking_code || '').startsWith('SPR-')
  }

  function startEdit(b: BookingRow) {
    if (isOnlineBooking(b)) return
    setSavedData((prev) => ({ ...prev, [b.id]: { status: b.status, payment_status: b.payment_status } }))
    setEditData({ status: b.status, payment_status: b.payment_status })
    setEditingId(b.id)
    setUpdateError('')
  }

  function cancelEdit(id: string) {
    const original = savedData[id]
    if (original) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...original } : b)))
    }
    setEditingId(null)
    setEditData(null)
    setUpdateError('')
  }

  async function saveEdit(id: string) {
    if (!editData) return
    setUpdateError('')
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ...editData } : b))
        )
        setEditingId(null)
        setEditData(null)
      } else {
        const data = await res.json()
        setUpdateError(data.error || 'Gagal mengupdate booking')
      }
    } catch (e) {
      console.error(e)
      setUpdateError('Gagal mengupdate booking')
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      confirmed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const paymentBadge = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      refunded: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div>
      <div className="admin-page-header flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Booking</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{bookings.length} booking</span>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            + Tambah Booking
          </button>
        </div>
      </div>

      <div className="admin-filterbar mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Cari nama/no. WA/kode..."
          className="form-input flex-1 min-w-[200px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchBookings()}
        />
        <select
          className="form-input w-auto"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter tipe"
        >
          <option value="">Semua Tipe</option>
          <option value="wisata">Wisata</option>
          <option value="toko">Toko</option>
          <option value="parkir">Parkir</option>
          <option value="sewa">Sewa</option>
        </select>
        <select
          className="form-input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status"
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          className="form-input w-auto"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          aria-label="Filter pembayaran"
        >
          <option value="">Semua Pembayaran</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div
        className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm"
        data-lenis-prevent
        data-scroll-container
      >
        {updateError && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {updateError}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium">{error}</p>
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Tidak ada booking</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Kode</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tipe</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Nama</th>
                <th className="px-4 py-3 font-semibold text-gray-700">No. WA</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Bayar</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                    {b.booking_code || b.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{b.type}</td>
                  <td className="px-4 py-3 text-gray-900">{b.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <a
                      href={`https://wa.me/${(b.customer_phone || '').replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      className="text-emerald-600 hover:underline"
                    >
                      {b.customer_phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.booking_mode === 'stay' && b.check_in_date
                      ? <><span className="block">{new Date(b.check_in_date).toLocaleDateString('id-ID')}–{b.check_out_date ? new Date(b.check_out_date).toLocaleDateString('id-ID') : '-'}</span><span className="text-xs text-gray-400">{b.nights} malam · {b.guest_count} tamu</span></>
                      : b.booking_date
                        ? new Date(b.booking_date).toLocaleDateString('id-ID')
                        : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatPrice(b.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === b.id ? (
                      <select
                        className="form-input text-xs py-1"
                        value={editData?.status || b.status}
                        onChange={(e) =>
                          setEditData((prev) => prev ? { ...prev, status: e.target.value } : null)
                        }
                        autoFocus
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => startEdit(b)}
                        disabled={isOnlineBooking(b)}
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(b.status)} ${isOnlineBooking(b) ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={isOnlineBooking(b) ? 'Booking online dikelola sistem' : undefined}
                        aria-label={b.status}
                      >
                        {b.status}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === b.id ? (
                      <select
                        className="form-input text-xs py-1"
                        value={editData?.payment_status || b.payment_status}
                        onChange={(e) =>
                          setEditData((prev) => prev ? { ...prev, payment_status: e.target.value } : null)
                        }
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => startEdit(b)}
                        disabled={isOnlineBooking(b)}
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge(b.payment_status)} ${isOnlineBooking(b) ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={isOnlineBooking(b) ? 'Booking online dikelola sistem' : undefined}
                        aria-label={b.payment_status}
                      >
                        {b.payment_status}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === b.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(b.id)}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => cancelEdit(b.id)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                    <div className="flex gap-2">
                      <Link
                        href={`/invoice/${b.id}?phone=${encodeURIComponent(b.customer_phone || '')}`}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Invoice
                      </Link>
                      <a
                        href={`https://wa.me/${(b.customer_phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${b.customer_name}, booking ${b.booking_code || ''} di Arenan Kalikesek.`)}`}
                        target="_blank"
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        WA
                      </a>
                      {b.document_type && (
                        <>
                          <button type="button" onClick={() => openIdentityDocument(b.id)} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                            {b.document_type.replace('_', ' ').toUpperCase()}
                          </button>
                          <button type="button" onClick={() => deleteIdentityDocument(b.id)} className="text-xs font-medium text-red-500 hover:text-red-600">Hapus dok.</button>
                        </>
                      )}
                    </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <AdminModal title="Tambah Booking Offline" onClose={() => setShowForm(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setSaveError('')

              const items = form.itemsText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const parts = line.match(/^(.+?)\s*x\s*(\d+)\s*[=:]\s*(\d[\d.,]*)$/) || line.match(/^(.+?)\s+(\d+)\s+(\d[\d.,]*)$/)
                  if (parts) {
                    return { id: parts[1].trim(), name: parts[1].trim(), quantity: parseInt(parts[2]), price: parseInt(parts[3].replace(/[.,]/g, '')) }
                  }
                  return { id: line, name: line, quantity: 1, price: 0 }
                })

              try {
                const res = await fetch('/api/admin/bookings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customerName: form.customerName,
                    customerPhone: form.customerPhone,
                    customerEmail: form.customerEmail || undefined,
                    customerAddress: form.customerAddress || undefined,
                    type: form.type,
                    bookingDate: form.bookingDate || undefined,
                    timeStart: form.timeStart || undefined,
                    timeEnd: form.timeEnd || undefined,
                    items,
                    totalAmount: form.totalAmount ? parseInt(form.totalAmount) : items.reduce((s, i) => s + i.price * i.quantity, 0),
                    paymentStatus: form.paymentStatus,
                  }),
                })
                if (res.ok) {
                  setShowForm(false)
                  setForm({ customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', type: 'wisata', bookingDate: '', timeStart: '', timeEnd: '', itemsText: '', totalAmount: '', paymentStatus: 'paid' })
                  fetchBookings()
                } else {
                  const data = await res.json()
                  setSaveError(data.error || 'Gagal menyimpan')
                }
              } catch {
                setSaveError('Gagal menyimpan')
              }
            }}
            className="space-y-3"
          >
            {saveError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="form-label">Nama Customer *</label>
                <input
                  className="form-input"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">No. WhatsApp *</label>
                <input
                  className="form-input"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Alamat</label>
                <input
                  className="form-input"
                  value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Tipe</label>
                <select
                  className="form-input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="wisata">Wisata</option>
                  <option value="toko">Toko</option>
                  <option value="sewa">Sewa</option>
                </select>
              </div>
              <div>
                <label className="form-label">Status Bayar</label>
                <select
                  className="form-input"
                  value={form.paymentStatus}
                  onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
                >
                  <option value="paid">Lunas</option>
                  <option value="unpaid">Belum Bayar</option>
                </select>
              </div>
              <div>
                <label className="form-label">Tanggal</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.bookingDate}
                  onChange={(e) => setForm({ ...form, bookingDate: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Jam Mulai</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.timeStart}
                  onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Jam Selesai</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.timeEnd}
                  onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Total (biarkan 0 utk auto)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Auto dari items"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">
                  Items <span className="text-xs text-gray-400">(satu baris: Nama x qty = harga atau Nama qty harga)</span>
                </label>
                <textarea
                  className="form-input font-mono text-sm"
                  rows={4}
                  placeholder={`Area Outbound x 2 = 50000\nSewa Homestay x 1 = 200000`}
                  value={form.itemsText}
                  onChange={(e) => setForm({ ...form, itemsText: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary flex-1">Simpan Booking</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1">Batal</button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  )
}
