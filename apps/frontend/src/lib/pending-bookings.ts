const PENDING_BOOKING_IDS_KEY = 'pending-booking-ids'
const LEGACY_PENDING_BOOKING_ID_KEY = 'pending-booking-id'

function readIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map((value) => String(value).trim()).filter(Boolean))]
    }
    const legacy = sessionStorage.getItem(LEGACY_PENDING_BOOKING_ID_KEY)?.trim()
    return legacy ? [legacy] : []
  } catch {
    return []
  }
}

function writeIds(ids: string[]) {
  if (typeof window === 'undefined') return
  const normalized = [...new Set(ids.map((value) => String(value).trim()).filter(Boolean))]
  try {
    if (normalized.length > 0) {
      sessionStorage.setItem(PENDING_BOOKING_IDS_KEY, JSON.stringify(normalized))
      // Pertahankan key lama untuk sesi/browser yang masih memakai versi lama.
      sessionStorage.setItem(LEGACY_PENDING_BOOKING_ID_KEY, normalized[normalized.length - 1])
    } else {
      sessionStorage.removeItem(PENDING_BOOKING_IDS_KEY)
      sessionStorage.removeItem(LEGACY_PENDING_BOOKING_ID_KEY)
    }
  } catch {
    // Penyimpanan browser dapat dibatasi; pembayaran tetap boleh dilanjutkan.
  }
}

export function getPendingBookingIds(): string[] {
  return readIds()
}

export function addPendingBookingId(id: string) {
  if (!id) return
  writeIds([...readIds(), id])
}

export function removePendingBookingId(id: string) {
  if (!id) return
  writeIds(readIds().filter((pendingId) => pendingId !== id))
}
