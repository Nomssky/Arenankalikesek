'use client'

import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { dateRangeContainsBlockedDate } from '@repo/shared-utils'

interface AvailabilityCalendarProps {
  month: string
  minimumDate: string
  blockedDates: readonly string[]
  checkIn: string
  checkOut: string
  onMonthChange: (month: string) => void
  onChange: (checkIn: string, checkOut: string) => void
  onError?: (message: string) => void
}

const weekdayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

function formatSelectedDate(date: string) {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00.000Z`)
  return {
    day: parsed.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    weekday: parsed.toLocaleDateString('id-ID', {
      weekday: 'long',
      timeZone: 'UTC',
    }),
  }
}

export default function AvailabilityCalendar({
  month,
  minimumDate,
  blockedDates,
  checkIn,
  checkOut,
  onMonthChange,
  onChange,
  onError,
}: AvailabilityCalendarProps) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1))
  const numberOfDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7
  const blocked = new Set(blockedDates)
  const monthLabel = firstDay.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const previousMonth = shiftMonth(month, -1)
  const canGoPrevious = !minimumDate || `${previousMonth}-31` >= minimumDate
  const formattedCheckIn = formatSelectedDate(checkIn)
  const formattedCheckOut = formatSelectedDate(checkOut)
  const selectionInstruction = !checkIn
    ? 'Pilih tanggal check-in'
    : !checkOut
      ? 'Sekarang pilih tanggal check-out'
      : 'Tanggal menginap sudah dipilih'

  const selectDate = (date: string) => {
    if (!checkIn || checkOut) {
      if (blocked.has(date)) return
      onChange(date, '')
      return
    }
    if (date <= checkIn) {
      if (blocked.has(date)) return
      onChange(date, '')
      return
    }
    if (dateRangeContainsBlockedDate(checkIn, date, blockedDates)) {
      onError?.('Rentang menginap melewati tanggal yang sudah terisi. Pilih tanggal lain.')
      return
    }
    onChange(checkIn, date)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="border-b border-emerald-50 bg-gradient-to-br from-emerald-950 to-emerald-800 p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-stretch gap-2">
          <button
            type="button"
            onClick={() => onChange('', '')}
            className={`min-w-0 rounded-xl border p-3 text-left transition ${
              !checkIn
                ? 'border-orange-300 bg-white shadow-sm ring-2 ring-orange-400/30'
                : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-[0.12em] ${!checkIn ? 'text-orange-600' : 'text-white/60'}`}>
              Check-in
            </span>
            <span className={`mt-1 block truncate text-sm font-bold sm:text-base ${!checkIn ? 'text-emerald-950' : 'text-white'}`}>
              {formattedCheckIn?.day || 'Pilih tanggal'}
            </span>
            <span className={`mt-0.5 block truncate text-[11px] ${!checkIn ? 'text-gray-500' : 'text-white/65'}`}>
              {formattedCheckIn ? `${formattedCheckIn.weekday} · mulai 14.00` : 'Tanggal kedatangan'}
            </span>
          </button>

          <div className="flex items-center justify-center text-white/60" aria-hidden="true">
            <span className="h-px w-full bg-white/25" />
            <ChevronRightIcon className="h-4 w-4 shrink-0" />
          </div>

          <button
            type="button"
            disabled={!checkIn}
            onClick={() => onChange(checkIn, '')}
            className={`min-w-0 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              checkIn && !checkOut
                ? 'border-orange-300 bg-white shadow-sm ring-2 ring-orange-400/30'
                : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-[0.12em] ${checkIn && !checkOut ? 'text-orange-600' : 'text-white/60'}`}>
              Check-out
            </span>
            <span className={`mt-1 block truncate text-sm font-bold sm:text-base ${checkIn && !checkOut ? 'text-emerald-950' : 'text-white'}`}>
              {formattedCheckOut?.day || 'Pilih tanggal'}
            </span>
            <span className={`mt-0.5 block truncate text-[11px] ${checkIn && !checkOut ? 'text-gray-500' : 'text-white/65'}`}>
              {formattedCheckOut ? `${formattedCheckOut.weekday} · sebelum 12.00` : 'Tanggal kepulangan'}
            </span>
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-white/80">
          <CalendarDaysIcon className="h-4 w-4 text-orange-300" />
          {selectionInstruction}
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-emerald-50 px-3 py-3 sm:px-4">
        <button
          type="button"
          aria-label="Bulan sebelumnya"
          disabled={!canGoPrevious}
          onClick={() => onMonthChange(previousMonth)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold capitalize text-emerald-950">{monthLabel}</p>
        <button
          type="button"
          aria-label="Bulan berikutnya"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-800 transition hover:bg-emerald-50"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 p-2 sm:p-4">
        {weekdayLabels.map((label) => (
          <div key={label} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">
            {label}
          </div>
        ))}
        {Array.from({ length: mondayOffset }, (_, index) => <div key={`empty-${index}`} />)}
        {Array.from({ length: numberOfDays }, (_, index) => {
          const date = `${month}-${String(index + 1).padStart(2, '0')}`
          const isPast = Boolean(minimumDate && date < minimumDate)
          const isBlocked = blocked.has(date)
          const isCheckIn = date === checkIn
          const isCheckOut = date === checkOut
          const isInRange = Boolean(checkIn && checkOut && date > checkIn && date < checkOut)
          const canUseBlockedAsCheckout = Boolean(checkIn && !checkOut && date > checkIn)
          const disabled = isPast || (isBlocked && !canUseBlockedAsCheckout)
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => selectDate(date)}
              aria-label={`${date}${isBlocked ? ', terisi' : ', tersedia'}`}
              className={`relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-xs font-semibold transition sm:text-sm ${
                isCheckIn || isCheckOut
                  ? 'bg-orange-500 text-white shadow-sm'
                  : isInRange
                    ? 'bg-orange-100 text-orange-800'
                    : isBlocked
                      ? 'bg-red-50 text-red-400 line-through'
                      : disabled
                        ? 'text-gray-300'
                        : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-800'
              }`}
            >
              {index + 1}
              {!disabled && !isBlocked && !isCheckIn && !isCheckOut && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-400" />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-emerald-50 px-4 py-3 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Tersedia</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-200" />Terisi</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" />Pilihan Anda</span>
      </div>
    </div>
  )
}
