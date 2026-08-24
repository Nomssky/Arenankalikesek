'use client'

import { useState } from 'react'

interface RingkasanSinkron {
  ok: boolean
  pesan: string
  sewa?: { perTab: Array<{ nama: string; jumlah: number }>; bookings: number; rentals: number; edu: number; gagalInsert: number }
  penginapan?: { perTab: Array<{ nama: string; jumlah: number }>; bookings: number; gagalInsert: number }
  masalah: string[]
}

// Tombol sinkron manual dari spreadsheet (real-time tanpa menunggu cron).
export default function SyncJadwalButton({ onSelesai }: { onSelesai?: () => void }) {
  const [jalan, setJalan] = useState(false)
  const [hasil, setHasil] = useState<RingkasanSinkron | null>(null)
  const [error, setError] = useState('')

  async function sinkron(paksa = false) {
    setJalan(true)
    setError('')
    try {
      const res = await fetch('/api/cron/sync-jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paksa ? { paksa: true } : {}),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? `Gagal (${res.status})`)
      } else {
        setHasil(body as RingkasanSinkron)
        if (body?.ok) onSelesai?.()
      }
    } catch {
      setError('Tidak dapat menghubungi server')
    }
    setJalan(false)
  }

  const gagalSafe = hasil && !hasil.ok && /fail-safe/i.test(hasil.pesan)

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void sinkron()}
          disabled={jalan}
          className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {jalan ? 'Menyinkronkan…' : 'Sinkronkan dari Spreadsheet'}
        </button>
        {gagalSafe && (
          <button
            type="button"
            onClick={() => void sinkron(true)}
            disabled={jalan}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            Paksa sinkron
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hasil && (
        <div
          className={`w-full max-w-md rounded-xl border p-3 text-sm ${
            hasil.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'
          }`}
          data-lenis-prevent
          data-scroll-container
        >
          <p className="font-semibold">{hasil.pesan}</p>
          {hasil.sewa && (
            <p className="mt-1">
              Sewa tempat: {hasil.sewa.bookings} booking · {hasil.sewa.rentals} rental ·{' '}
              {hasil.sewa.edu} eduwisata
              {hasil.sewa.gagalInsert > 0 && ` · ${hasil.sewa.gagalInsert} gagal`}
            </p>
          )}
          {hasil.penginapan && (
            <p>
              Penginapan: {hasil.penginapan.bookings} malam
              {hasil.penginapan.gagalInsert > 0 && ` · ${hasil.penginapan.gagalInsert} gagal`}
            </p>
          )}
          {hasil.masalah.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">
                {hasil.masalah.length} catatan baris dilewati
              </summary>
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
                {hasil.masalah.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
