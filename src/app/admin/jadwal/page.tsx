'use client'

import { useEffect, useState, useReducer } from 'react'
import { formatDate } from '@/lib/utils'

interface RentalRow {
  id: string
  booking_id: string
  item_id: string
  item_name: string | null
  quantity: number
  booking_date: string
  time_start: string | null
  time_end: string | null
  total_price: number
  status: string
  created_at: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string } | null
}

interface State {
  rentals: RentalRow[]
  loading: boolean
  error: string
}

type Action =
  | { type: 'fetch_start' }
  | { type: 'fetch_ok'; data: RentalRow[] }
  | { type: 'fetch_err' }

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'fetch_start': return { rentals: [], loading: true, error: '' }
    case 'fetch_ok': return { rentals: action.data, loading: false, error: '' }
    case 'fetch_err': return { rentals: [], loading: false, error: 'Gagal memuat jadwal' }
  }
}

export default function AdminJadwalPage() {
  const [{ rentals, loading, error }, dispatch] = useReducer(reducer, {
    rentals: [], loading: true, error: '',
  })
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'fetch_start' })

    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterDate) params.set('start_date', filterDate)
    if (filterDate) params.set('end_date', filterDate)
    const qs = params.toString()

    fetch(`/api/admin/rentals${qs ? `?${qs}` : ''}`)
      .then((res) => { if (!cancelled && res.ok) return res.json(); throw new Error() })
      .then((data) => { if (!cancelled) dispatch({ type: 'fetch_ok', data }) })
      .catch(() => { if (!cancelled) dispatch({ type: 'fetch_err' }) })

    return () => { cancelled = true }
  }, [filterStatus, filterDate, refreshKey])

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/admin/rentals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setRefreshKey((k) => k + 1)
  }

  const statusBadge: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    returned: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="text-2xl font-bold text-gray-900">Jadwal Rental</h1>
      </div>

      <div className="admin-filterbar mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="form-label">Filter Tanggal</label>
          <input
            type="date"
            className="form-input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Filter Status</label>
          <select
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="active">Active</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button onClick={() => { setFilterDate(''); setFilterStatus('') }} className="btn-outline text-sm">
          Reset
        </button>
      </div>

      <div className="admin-table-scroll admin-table-scroll--wide mt-4 rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            <p className="text-lg font-medium">{error}</p>
          </div>
        ) : rentals.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Belum ada data rental</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700">Item</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Penyewa</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Jam</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Qty</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rentals.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.item_name || r.item_id || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">ID: {r.item_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.bookings?.customer_name || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.bookings?.customer_phone || ''}
                      {r.bookings?.booking_code ? ` · ${r.bookings.booking_code}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(r.booking_date) || r.booking_date}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.time_start ? `${r.time_start.substring(0, 5)}${r.time_end ? ` - ${r.time_end.substring(0, 5)}` : ''}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[r.status] || 'bg-gray-100 text-gray-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {r.status === 'active' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(r.id, 'returned')}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            Kembali
                          </button>
                          <button
                            onClick={() => handleStatusChange(r.id, 'cancelled')}
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Batal
                          </button>
                        </>
                      )}
                      {r.status === 'returned' && (
                        <span className="text-sm text-gray-400">Selesai</span>
                      )}
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
