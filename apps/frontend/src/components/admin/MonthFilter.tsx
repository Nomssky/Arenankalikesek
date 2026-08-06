import { useId } from 'react'

interface MonthFilterProps {
  value: string
  onChange: (month: string) => void
}

export default function MonthFilter({ value, onChange }: MonthFilterProps) {
  const id = useId()
  return (
    <input
      id={id}
      type="month"
      className="form-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
