'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'

interface MonthFilterProps {
  value: string
  onChange: (month: string) => void
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const

export default function MonthFilter({ value, onChange }: MonthFilterProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonId = useId()

  const [year, month] = (value || '').split('-').map(Number)
  const [viewYear, setViewYear] = useState(Number.isFinite(year) ? year : new Date().getFullYear())

  useEffect(() => {
    if (open) {
      const close = (event: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
      }
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false)
      }
      window.addEventListener('mousedown', close)
      window.addEventListener('keydown', onEscape)
      return () => {
        window.removeEventListener('mousedown', close)
        window.removeEventListener('keydown', onEscape)
      }
    }
  }, [open])

  const label = Number.isFinite(year) && Number.isFinite(month)
    ? `${MONTHS[month - 1]} ${year}`
    : 'Pilih bulan'

  const selectMonth = (index: number) => {
    onChange(`${viewYear}-${String(index + 1).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((wasOpen) => !wasOpen)
          if (Number.isFinite(year)) setViewYear(year)
        }}
        className="form-input flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{label}</span>
        <CalendarDaysIcon className="h-5 w-5 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full min-w-64 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl" role="listbox" aria-label="Pilih bulan">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Tahun sebelumnya"
              onClick={() => setViewYear((y) => y - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-gray-900">{viewYear}</span>
            <button
              type="button"
              aria-label="Tahun berikutnya"
              onClick={() => setViewYear((y) => y + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, index) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={year === viewYear && month === index + 1}
                onClick={() => selectMonth(index)}
                className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                  year === viewYear && month === index + 1
                    ? 'bg-emerald-700 text-white'
                    : 'text-gray-700 hover:bg-emerald-50'
                }`}
              >
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
