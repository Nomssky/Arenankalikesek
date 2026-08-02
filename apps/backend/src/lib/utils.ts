export function generateId(): string {
  return `BKG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}
