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
