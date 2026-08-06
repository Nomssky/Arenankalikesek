import { useId } from 'react'

// Pilihan bulan+ tahun cross-browser untuk admin. Menggantikan <input type="month">
// yang di Firefox/Safari jatuh ke kotak teks bebas (bisa diketik). Nilai tetap "YYYY-MM".

const MONTHS = [
  ['01', 'Januari'],
  ['02', 'Februari'],
  ['03', 'Maret'],
  ['04', 'April'],
  ['05', 'Mei'],
  ['06', 'Juni'],
  ['07', 'Juli'],
  ['08', 'Agustus'],
  ['09', 'September'],
  ['10', 'Oktober'],
  ['11', 'November'],
  ['12', 'Desember'],
] as const

interface MonthFilterProps {
  value: string
  onChange: (month: string) => void
}

export default function MonthFilter({ value, onChange }: MonthFilterProps) {
  const yearSelectId = useId()
  const monthSelectId = useId()
  const [year, month] = (value || '').split('-')
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 4 }, (_, index) => currentYear - 1 + index)
  if (year && !years.includes(Number(year))) years.push(Number(year))
  years.sort((a, b) => a - b)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        id={monthSelectId}
        aria-label="Bulan"
        className="form-select w-auto flex-1"
        value={MONTHS.some(([code]) => code === month) ? month : ''}
        onChange={(event) => onChange(`${year || String(currentYear)}-${event.target.value}`)}
      >
        <option value="">-- Bulan --</option>
        {MONTHS.map(([code, label]) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
      <select
        id={yearSelectId}
        aria-label="Tahun"
        className="form-select w-auto"
        value={year || String(currentYear)}
        onChange={(event) => onChange(`${event.target.value}-${month || '01'}`)}
      >
        {years.map((value) => (
          <option key={value} value={String(value)}>{value}</option>
        ))}
      </select>
    </div>
  )
}
