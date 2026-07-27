export function formatPrice(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`
}

export function generateId(): string {
  return `BKG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

