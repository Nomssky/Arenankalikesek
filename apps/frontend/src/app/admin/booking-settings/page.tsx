'use client'

import { useEffect, useState } from 'react'

interface SettingRow {
  key: string
  group_name: string
  label: string
  value_numeric: number | null
  unit: string
  editable: boolean
}

const groupLabels: Record<string, string> = {
  camping: 'Camping & Glamping',
  add_on: 'Add-on Camping',
  addon: 'Add-on Camping',
  homestay: 'Homestay',
  edu_trip: 'Edu Trip',
  rental: 'Add-on Sewa Tempat',
}

const nullableKeys = new Set([
  'camping.tent_rental_price',
  'camping.glamping_base_price',
  'addon.nesting_price',
  'addon.camping_chair_price',
])

export default function BookingSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/booking-settings')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: SettingRow[]) => {
        setRows(data)
        setValues(Object.fromEntries(data.map((row) => [row.key, row.value_numeric === null ? '' : String(row.value_numeric)])))
      })
      .catch(() => setError('Gagal memuat pengaturan booking.'))
      .finally(() => setLoading(false))
  }, [])

  const groups = Object.entries(Object.groupBy(rows, (row) => row.group_name))

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    const settings = Object.fromEntries(rows.map((row) => [
      row.key,
      values[row.key] === '' && nullableKeys.has(row.key) ? null : Number(values[row.key]),
    ]))
    try {
      const response = await fetch('/api/admin/booking-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan')
      setRows(data)
      setValues(Object.fromEntries(data.map((row: SettingRow) => [row.key, row.value_numeric === null ? '' : String(row.value_numeric)])))
      setMessage('Pengaturan booking berhasil disimpan.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Booking</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">Kelola harga camping, add-on sewa tempat, kapasitas dasar Aren 1/2, biaya tamu tambahan, dan kuota Edu Trip. Nilai kosong berarti harga belum tersedia.</p>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {message && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" /></div>
      ) : (
        <form onSubmit={saveSettings} className="mt-5 space-y-6">
          {groups.map(([group, groupRows]) => (
            <section key={group} className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-bold text-emerald-950">{groupLabels[group] || group}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(groupRows || []).map((row) => (
                  <label key={row.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <span className="text-sm font-semibold text-gray-800">{row.label}</span>
                    <span className="mt-1 block text-xs text-gray-500">{row.unit || row.key}</span>
                    <input
                      type="number"
                      min={row.key.includes('capacity') || row.key.includes('quota') ? 1 : 0}
                      step={1}
                      disabled={!row.editable}
                      className="form-input mt-3 bg-white"
                      value={values[row.key] ?? ''}
                      placeholder={nullableKeys.has(row.key) ? 'Belum ditetapkan' : '0'}
                      required={!nullableKeys.has(row.key)}
                      onChange={(event) => setValues((current) => ({ ...current, [row.key]: event.target.value }))}
                    />
                    {nullableKeys.has(row.key) && values[row.key] === '' && <span className="mt-2 block text-xs font-medium text-orange-600">Frontend menampilkan “Hubungi pengelola”.</span>}
                  </label>
                ))}
              </div>
            </section>
          ))}
          <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50 sm:w-auto">{saving ? 'Menyimpan...' : 'Simpan pengaturan'}</button>
        </form>
      )}
    </div>
  )
}
