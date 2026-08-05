export function generateId(): string {
  return `BKG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

export function digits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function timeToMinutes(value: string | null | undefined): number | null {
  if (value == null) return null
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function timeOverlaps(
  start: string | null,
  end: string | null | undefined,
  otherStart: string | null,
  otherEnd: string | null,
): boolean {
  if (!start || !otherStart) return true
  const startMinute = timeToMinutes(start)
  const endMinute = timeToMinutes(end) ?? (startMinute === null ? null : startMinute + 60)
  const otherStartMinute = timeToMinutes(otherStart)
  const otherEndMinute = timeToMinutes(otherEnd) ?? (otherStartMinute === null ? null : otherStartMinute + 60)
  if (startMinute === null || endMinute === null || otherStartMinute === null || otherEndMinute === null) return true
  return startMinute < otherEndMinute && endMinute > otherStartMinute
}
