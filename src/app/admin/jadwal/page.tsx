'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatPrice } from '@/lib/utils'
import { isAccommodationItem } from '@/lib/booking-domain'

interface RentalRow {
  id: string
  booking_id: string
  item_id: string
  item_name: string | null
  quantity: number
  booking_date: string
  time_start: string | null
  time_end: string | null
  status: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string } | null
}

interface AccommodationRow {
  id: string
  booking_id: string
  item_name: string
  accommodation_type: string
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
  tent_size: string | null
  tent_count: number | null
  tent_option: string | null
  total_price: number
  status: string
  bookings: { customer_name: string; customer_phone: string; booking_code: string; status: string; document_type: string | null } | null
}

interface DateBlock {
  id: string
  item_id: string
  item_name: string | null
  start_date: string
  end_date: string
  reason: string | null
}

interface StayOption { id: string; name: string }
interface HolidayDate { holiday_date: string; label: string | null }

export default function AdminJadwalPage() {
  const [tab, setTab] = useState<'rental' | 'accommodation'>('rental')
  const [filterDate, setFilterDate] = useState('')
  const [rentals, setRentals] = useState<RentalRow[]>([])
  const [accommodations, setAccommodations] = useState<AccommodationRow[]>([])
  const [blocks, setBlocks] = useState<DateBlock[]>([])
  const [stayOptions, setStayOptions] = useState<StayOption[]>([])
  const [holidayDates, setHolidayDates] = useState<HolidayDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockForm, setBlockForm] = useState({ itemId: '', startDate: '', endDate: '', reason: '' })
  const [holidayForm, setHolidayForm] = useState({ date: '', label: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    params.set('_refresh', String(refreshKey))
    if (filterDate) {
      params.set('start_date', filterDate)
      params.set('end_date', filterDate)
    }
    try {
      const [rentalsResponse, staysResponse, blocksResponse, packagesResponse, holidaysResponse] = await Promise.all([
        fetch(`/api/admin/rentals?${params}`),
        fetch(`/api/admin/accommodations?${params}`),
        fetch('/api/admin/booking-date-blocks'),
        fetch('/api/tour-packages?available=true'),
        fetch('/api/admin/booking-holiday-dates'),
      ])
      if (![rentalsResponse, staysResponse, blocksResponse, packagesResponse, holidaysResponse].every((response) => response.ok)) throw new Error()
      const [rentalData, stayData, blockData, packageData, holidayData] = await Promise.all([
        rentalsResponse.json(), staysResponse.json(), blocksResponse.json(), packagesResponse.json(), holidaysResponse.json(),
      ])
      setRentals(rentalData)
      setAccommodations(stayData)
      setBlocks(blockData)
      setHolidayDates(holidayData)
      const options = packageData.filter((item: StayOption) => isAccommodationItem(item.id))
      setStayOptions(options)
      setBlockForm((current) => ({ ...current, itemId: current.itemId || options[0]?.id || '' }))
    } catch {
      setError('Gagal memuat jadwal. Pastikan migrasi database terbaru sudah dijalankan.')
    } finally {
      setLoading(false)
    }
  }, [filterDate, refreshKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  async function updateRentalStatus(id: string, status: string) {
    const response = await fetch(`/api/admin/rentals/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  async function cancelAccommodation(bookingId: string) {
    if (!window.confirm('Batalkan booking ini dan buka kembali tanggalnya?')) return
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }),
    })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  async function createDateBlock(event: React.FormEvent) {
    event.preventDefault()
    const option = stayOptions.find((item) => item.id === blockForm.itemId)
    const response = await fetch('/api/admin/booking-date-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...blockForm, itemName: option?.name }),
    })
    if (!response.ok) {
      const data = await response.json()
      setError(data.error || 'Gagal menutup tanggal')
      return
    }
    setShowBlockForm(false)
    setBlockForm((current) => ({ ...current, startDate: '', endDate: '', reason: '' }))
    setRefreshKey((value) => value + 1)
  }

  async function removeDateBlock(id: string) {
    const response = await fetch(`/api/admin/booking-date-blocks?id=${id}`, { method: 'DELETE' })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  async function saveHolidayDate(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/admin/booking-holiday-dates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(holidayForm),
    })
    if (response.ok) {
      setHolidayForm({ date: '', label: '' })
      setRefreshKey((value) => value + 1)
    }
  }

  async function removeHolidayDate(date: string) {
    const response = await fetch(`/api/admin/booking-holiday-dates?date=${date}`, { method: 'DELETE' })
    if (response.ok) setRefreshKey((value) => value + 1)
  }

  return (
    <div>
      <div className="admin-page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Booking</h1>
          <p className="mt-1 text-sm text-gray-500">Sewa per jam dan penginapan per malam dikelola terpisah.</p>
        </div>
        {tab === 'accommodation' && <button type="button" onClick={() => setShowBlockForm((value) => !value)} className="btn-primary text-sm">{showBlockForm ? 'Tutup form' : '+ Tutup tanggal'}</button>}
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm sm:max-w-lg">
        <button type="button" onClick={() => setTab('rental')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'rental' ? 'bg-emerald-700 text-white' : 'text-gray-600'}`}>Sewa Tempat</button>
        <button type="button" onClick={() => setTab('accommodation')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'accommodation' ? 'bg-emerald-700 text-white' : 'text-gray-600'}`}>Penginapan & Camping</button>
      </div>

      <div className="admin-filterbar mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <label className="form-label">Filter tanggal</label>
          <input type="date" className="form-input" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
        </div>
        {filterDate && <button type="button" onClick={() => setFilterDate('')} className="btn-outline text-sm">Reset</button>}
      </div>

      {showBlockForm && tab === 'accommodation' && (
        <form onSubmit={createDateBlock} className="mt-4 grid gap-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="form-label">Unit</label><select className="form-select" value={blockForm.itemId} onChange={(event) => setBlockForm({ ...blockForm, itemId: event.target.value })}>{stayOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label className="form-label">Mulai ditutup</label><input required type="date" className="form-input" value={blockForm.startDate} onChange={(event) => setBlockForm({ ...blockForm, startDate: event.target.value })} /></div>
          <div><label className="form-label">Dibuka kembali</label><input required type="date" min={blockForm.startDate} className="form-input" value={blockForm.endDate} onChange={(event) => setBlockForm({ ...blockForm, endDate: event.target.value })} /></div>
          <div><label className="form-label">Alasan</label><input className="form-input" value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} placeholder="Perawatan, acara, dll." /></div>
          <button className="btn-primary sm:col-span-2 lg:col-span-4">Simpan tanggal tutup</button>
        </form>
      )}

      {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>
      ) : tab === 'rental' ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rentals.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-gray-900">{row.item_name || row.item_id}</h2><p className="text-xs text-gray-500">{row.bookings?.booking_code}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'active' ? 'bg-blue-50 text-blue-700' : row.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{row.status}</span></div>
              <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Penyewa</dt><dd className="text-right font-semibold">{row.bookings?.customer_name || '-'}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Tanggal</dt><dd>{formatDate(row.booking_date)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Jam</dt><dd>{row.time_start?.slice(0, 5) || '-'}{row.time_end ? `–${row.time_end.slice(0, 5)}` : ''}</dd></div></dl>
              {row.status === 'active' && <div className="mt-4 flex gap-2"><button onClick={() => updateRentalStatus(row.id, 'returned')} className="btn-outline flex-1 text-xs">Selesai</button><button onClick={() => updateRentalStatus(row.id, 'cancelled')} className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">Batal</button></div>}
            </article>
          ))}
          {rentals.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-gray-500 md:col-span-2 xl:col-span-3">Belum ada jadwal sewa.</p>}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accommodations.map((row) => (
              <article key={row.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600">{row.accommodation_type}</p><h2 className="font-bold text-gray-900">{row.item_name}</h2><p className="text-xs text-gray-500">{row.bookings?.booking_code}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{row.status}</span></div>
                <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Pemesan</dt><dd className="text-right font-semibold">{row.bookings?.customer_name || '-'}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Menginap</dt><dd className="text-right">{formatDate(row.check_in_date)}–{formatDate(row.check_out_date)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Durasi/tamu</dt><dd>{row.nights} malam · {row.guest_count} orang</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Total</dt><dd className="font-semibold">{formatPrice(row.total_price)}</dd></div></dl>
                <div className="mt-4 flex flex-wrap gap-2"><Link href={`/invoice/${row.booking_id}`} className="btn-outline text-xs">Invoice</Link>{row.status === 'active' && <button onClick={() => cancelAccommodation(row.booking_id)} className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">Batalkan</button>}</div>
              </article>
            ))}
            {accommodations.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-gray-500 md:col-span-2 xl:col-span-3">Belum ada booking penginapan.</p>}
          </div>

          <section className="mt-7 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900">Tanggal yang ditutup admin</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {blocks.map((block) => <div key={block.id} className="rounded-xl border border-orange-100 bg-orange-50 p-4"><p className="font-semibold text-gray-900">{block.item_name || block.item_id}</p><p className="mt-1 text-sm text-gray-600">{formatDate(block.start_date)}–{formatDate(block.end_date)}</p>{block.reason && <p className="mt-1 text-xs text-gray-500">{block.reason}</p>}<button onClick={() => removeDateBlock(block.id)} className="mt-3 text-xs font-semibold text-red-600">Buka kembali tanggal</button></div>)}
              {blocks.length === 0 && <p className="text-sm text-gray-500">Tidak ada tanggal yang ditutup manual.</p>}
            </div>
          </section>

          <section className="mt-7 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-900">Kalender tarif Holiday</h2>
            <p className="mt-1 text-sm text-gray-500">Tanggal di sini otomatis memakai tarif Holiday homestay. Sistem tidak menebak tanggal libur.</p>
            <form onSubmit={saveHolidayDate} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              <input required type="date" className="form-input" value={holidayForm.date} onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })} aria-label="Tanggal libur" />
              <input className="form-input" value={holidayForm.label} onChange={(event) => setHolidayForm({ ...holidayForm, label: event.target.value })} placeholder="Nama hari libur/acara" />
              <button className="btn-primary text-sm">Tambah tanggal</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {holidayDates.map((holiday) => <span key={holiday.holiday_date} className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-2 text-xs text-orange-800"><strong>{formatDate(holiday.holiday_date)}</strong>{holiday.label || 'Holiday'}<button type="button" onClick={() => removeHolidayDate(holiday.holiday_date)} className="font-bold text-red-500" aria-label={`Hapus ${holiday.holiday_date}`}>×</button></span>)}
              {holidayDates.length === 0 && <p className="text-sm text-gray-500">Belum ada tanggal tarif Holiday.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
