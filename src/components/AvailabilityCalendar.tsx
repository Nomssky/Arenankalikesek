'use client'

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { dateRangeContainsBlockedDate } from '@/lib/booking-domain'

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
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white">
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
