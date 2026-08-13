import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase-server'
import { createSnapTransaction, isMidtransConfigured } from '../../../lib/midtrans'
import { sendBookingCreated } from '../../../lib/email'
import { digits, generateId, timeOverlaps, timeToMinutes, clientIp } from '../../../lib/utils'
import { RENTAL_VENUE_CATEGORIES } from '../../../lib/inventory'
import { requireAdmin } from '../../../lib/admin-guard'
import { loadBookingSettings } from '../../../lib/booking-settings'
import { loadProductCatalog, loadResolvedTourCatalog } from '../../../lib/catalog'
import {
  accommodationTypeForItem,
  calculateCampingTotal,
  calculateExtraGuestTotal,
  calculateHomestayBase,
  differenceInNights,
  EDU_TRIP_MIN_PARTICIPANTS,
  isAccommodationItem,
  isEduTripItem,
  resolveBookingQuantity,
} from '@repo/shared-utils'
import type { BookingType } from '@repo/shared-types'

interface ClientBookingItem {
  id?: string
  name: string
  category?: string
  quantity?: number
  price: number
  bookingDate?: string
  timeStart?: string
  timeEnd?: string
  checkInDate?: string
  checkOutDate?: string
  participantCount?: number
  metadata?: Record<string, unknown>
}

interface AccommodationSelection {
  itemId: string
  guestCount: number
  extraBedQuantity: number
  checkInDate?: string
  checkOutDate?: string
  tentSize?: 'small' | 'large'
  tentCount?: number
  tentOption?: 'own' | 'rent'
  firewoodPackages?: number
  nestingQuantity?: number
  chairQuantity?: number
}

interface BookingPayload {
  type?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  eventName?: string
  bookingDate?: string
  timeStart?: string
  timeEnd?: string
  participantCount?: number | string
  notes?: string
  items?: ClientBookingItem[]
  accommodations?: AccommodationSelection[]
  totalAmount?: number | string
  checkInDate?: string
  checkOutDate?: string
  guestCount?: number | string
  documentType?: string
  tentSize?: 'small' | 'large'
  tentCount?: number | string
  tentOption?: 'own' | 'rent'
  firewoodPackages?: number | string
  nestingQuantity?: number | string
  chairQuantity?: number | string
  extraBedQuantity?: number | string
  rentalChairQuantity?: number | string
  rentalSoundSystem?: boolean | string
  rentalMatQuantity?: number | string
}

function generateBookingCode(): string {
  const now = new Date()
  const yymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BKK-${yymm}-${rand}`
}

function positiveInteger(value: unknown, fallback = 1) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback
}

function optionalQuantity(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

const MAX_PENDING_PER_PHONE = 3
// Anti spam slot-hold lintas nomor: batas percobaan reserve per-IP dalam jendela
// 15 menit (DB-backed via record_booking_create_attempt, migration 026 — sama
// polanya dengan admin_login_attempts, bukan Map in-memory). Hanya percobaan
// yang lolos validasi & sampai tahap reserve yang dihitung.
const MAX_CREATE_PER_IP = 10

function isRentalVenueItem(item: ClientBookingItem) {
  return Boolean(item.category && RENTAL_VENUE_CATEGORIES.includes(item.category))
}

function isValidWhatsAppNumber(value: string) {
  return /^(?:08\d{8,11}|628\d{8,11})$/.test(digits(value))
}

function safeClientItems(value: unknown): ClientBookingItem[] | null {
  if (!Array.isArray(value)) return null
  const result: ClientBookingItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const candidate = item as Record<string, unknown>
    const name = String(candidate.name || '').trim()
    const price = Number(candidate.price)
    if (!name || !Number.isFinite(price) || price < 0) return null
    result.push({
      id: candidate.id ? String(candidate.id) : undefined,
      name,
      category: candidate.category ? String(candidate.category) : undefined,
      quantity: positiveInteger(candidate.quantity, 1),
      price,
      bookingDate: candidate.bookingDate ? String(candidate.bookingDate) : undefined,
      timeStart: candidate.timeStart ? String(candidate.timeStart) : undefined,
      timeEnd: candidate.timeEnd ? String(candidate.timeEnd) : undefined,
      checkInDate: candidate.checkInDate ? String(candidate.checkInDate) : undefined,
      checkOutDate: candidate.checkOutDate ? String(candidate.checkOutDate) : undefined,
      participantCount: candidate.participantCount === undefined ? undefined : positiveInteger(candidate.participantCount, 1),
      metadata: candidate.metadata && typeof candidate.metadata === 'object' ? candidate.metadata as Record<string, unknown> : undefined,
    })
  }
  return result
}

function safeAccommodationSelections(value: unknown): AccommodationSelection[] | null {
  if (value === undefined || value === null || value === '') return []
  if (!Array.isArray(value)) return null
  const result: AccommodationSelection[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const candidate = entry as Record<string, unknown>
    const itemId = String(candidate.itemId || '').trim()
    if (!itemId) return null
    const tentSize = candidate.tentSize === 'large' ? 'large' : candidate.tentSize === 'small' ? 'small' : undefined
    const tentOption = candidate.tentOption === 'rent' ? 'rent' : candidate.tentOption === 'own' ? 'own' : undefined
    result.push({
      itemId,
      guestCount: positiveInteger(candidate.guestCount, 1),
      extraBedQuantity: optionalQuantity(candidate.extraBedQuantity),
      checkInDate: candidate.checkInDate ? String(candidate.checkInDate) : undefined,
      checkOutDate: candidate.checkOutDate ? String(candidate.checkOutDate) : undefined,
      tentSize,
      tentCount: candidate.tentCount === undefined ? undefined : positiveInteger(candidate.tentCount, 1),
      tentOption,
      firewoodPackages: optionalQuantity(candidate.firewoodPackages),
      nestingQuantity: optionalQuantity(candidate.nestingQuantity),
      chairQuantity: optionalQuantity(candidate.chairQuantity),
    })
  }
  return result
}

type TourCatalogItem = Awaited<ReturnType<typeof loadResolvedTourCatalog>>['data'][number]
type ProductCatalogItem = Awaited<ReturnType<typeof loadProductCatalog>>['data'][number]

function authoritativeItemPrice(
  item: ClientBookingItem,
  tourCatalog: TourCatalogItem[],
  productCatalog: ProductCatalogItem[],
): number | null {
  const id = item.id
  if (!id) return null
  const service = tourCatalog.find((entry) => entry.id === id)
  if (service) {
    if (!service.available || !service.bookable) return null
    if (service.pricing_type === 'free') return 0
    if (['fixed', 'range'].includes(service.pricing_type)) return service.price
    if (service.pricing_type === 'rates') {
      return service.rate_options.some((rate) => rate.price === item.price) ? item.price : null
    }
    return null
  }
  const product = productCatalog.find((entry) => entry.id === id)
  return product?.purchasable ? product.price : null
}

async function parseBookingRequest(request: NextRequest): Promise<{
  payload: BookingPayload
  identityDocument: File | null
}> {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return { payload: await request.json(), identityDocument: null }
  }

  const form = await request.formData()
  const rawItems = String(form.get('items') || '[]')
  const rawAccommodations = String(form.get('accommodations') || '[]')
  let items: unknown
  let accommodations: unknown
  try {
    items = JSON.parse(rawItems)
    accommodations = JSON.parse(rawAccommodations)
  } catch {
    throw new Error('Data booking tidak valid')
  }
  const payload: BookingPayload = {
    type: String(form.get('type') || ''),
    customerName: String(form.get('customerName') || ''),
    customerPhone: String(form.get('customerPhone') || ''),
    customerEmail: String(form.get('customerEmail') || ''),
    customerAddress: String(form.get('customerAddress') || ''),
    eventName: String(form.get('eventName') || ''),
    notes: String(form.get('notes') || ''),
    items: items as ClientBookingItem[],
    accommodations: accommodations as AccommodationSelection[],
    bookingDate: String(form.get('bookingDate') || ''),
    timeStart: String(form.get('timeStart') || ''),
    timeEnd: String(form.get('timeEnd') || ''),
    participantCount: String(form.get('participantCount') || '1'),
    checkInDate: String(form.get('checkInDate') || ''),
    checkOutDate: String(form.get('checkOutDate') || ''),
    guestCount: String(form.get('guestCount') || '1'),
    documentType: String(form.get('documentType') || ''),
    tentSize: String(form.get('tentSize') || '') as BookingPayload['tentSize'],
    tentCount: String(form.get('tentCount') || '1'),
    tentOption: String(form.get('tentOption') || '') as BookingPayload['tentOption'],
    firewoodPackages: String(form.get('firewoodPackages') || '0'),
    nestingQuantity: String(form.get('nestingQuantity') || '0'),
    chairQuantity: String(form.get('chairQuantity') || '0'),
    extraBedQuantity: String(form.get('extraBedQuantity') || '0'),
    rentalChairQuantity: String(form.get('rentalChairQuantity') || '0'),
    rentalSoundSystem: String(form.get('rentalSoundSystem') || 'false'),
    rentalMatQuantity: String(form.get('rentalMatQuantity') || '0'),
  }
  const fileValue = form.get('identityDocument')
  return { payload, identityDocument: fileValue instanceof File ? fileValue : null }
}

function arenaNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: (Number(value('hour')) * 60) + Number(value('minute')),
  }
}

async function checkRentalAvailability(
  items: ClientBookingItem[],
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !bookingDate || !items.length) return null
  const supabase = getSupabaseAdmin()
  // E5: buang hold yang sudah kedaluwarsa dulu supaya slot yang sebelumnya
  // di-hold (tetapi booking-nya gagal/batal) tidak memicu 409 palsu saat dicek.
  await supabase.rpc('expire_stale_booking_holds').then(() => undefined, () => undefined)
  for (const item of items) {
    if (!item.id) continue
    const itemDate = item.bookingDate || bookingDate
    const itemStart = item.timeStart || timeStart
    const itemEnd = item.timeEnd || timeEnd
    if (!itemDate) return `Tanggal layanan "${item.name}" belum ditentukan.`
    const { data: conflicts, error } = await supabase
      .from('rental_bookings')
      .select('time_start, time_end')
      .eq('item_id', item.id)
      .eq('booking_date', itemDate)
      .in('status', ['hold', 'active'])
    if (error) return 'Ketersediaan jadwal gagal diperiksa. Silakan muat ulang dan pilih jadwal kembali.'
    if (!conflicts?.length) continue
    if (!itemStart || conflicts.some((row) => !row.time_start || timeOverlaps(itemStart, itemEnd, row.time_start, row.time_end))) {
      return `Ketersediaan jadwal berubah. “${item.name}” sudah dibooking pada rentang tersebut. Silakan pilih jadwal lain.`
    }
  }
  return null
}

function rentalEntries(
  items: ClientBookingItem[],
  bookingId: string,
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
) {
  return items.flatMap((item) => {
    const itemDate = item.bookingDate || bookingDate
    if (!itemDate) return []
    const itemStart = item.timeStart || timeStart
    const itemEnd = item.timeEnd || timeEnd
    const startAt = itemStart ? `${itemDate}T${itemStart}:00+07:00` : `${itemDate}T00:00:00+07:00`
    const endAt = itemEnd ? `${itemDate}T${itemEnd}:00+07:00` : `${itemDate}T23:59:00+07:00`
    return [{
    id: generateId(),
    booking_id: bookingId,
    item_id: item.id || `item-${crypto.randomUUID()}`,
    item_name: item.name,
    quantity: item.quantity || 1,
    booking_date: itemDate,
    time_start: itemStart || null,
    time_end: itemEnd || null,
    start_at: startAt,
    end_at: endAt,
    total_price: item.price * (item.quantity || 1),
    }]
  })
}

function rpcErrorMessage(message?: string) {
  const normalized = message || ''
  if (normalized.includes('Kuota Edu Trip')) return { message: 'Kuota Edu Trip pada tanggal tersebut sudah penuh', status: 409 }
  if (normalized.includes('sudah dibooking') || normalized.includes('overlap')) {
    return { message: 'Ketersediaan jadwal berubah. Rentang tersebut baru saja dipesan. Silakan pilih jadwal lain.', status: 409 }
  }
  if (normalized.includes('sedang ditutup')) return { message: 'Tanggal tersebut sedang ditutup oleh pengelola', status: 409 }
  return { message: 'Gagal menyimpan booking. Pastikan migrasi database terbaru sudah dijalankan.', status: 500 }
}

export async function POST(request: NextRequest) {
  let uploadedDocumentPath: string | null = null
  try {
    const { payload, identityDocument } = await parseBookingRequest(request)
    const customerName = payload.customerName?.trim() || ''
    const customerPhone = payload.customerPhone?.trim() || ''
    const customerEmail = payload.customerEmail?.trim() || ''
    const customerAddress = payload.customerAddress?.trim() || ''
    const eventName = payload.eventName?.trim() || ''
    const notes = payload.notes?.trim() || ''
    const items = safeClientItems(payload.items)

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Nama dan nomor WhatsApp harus diisi' }, { status: 400 })
    }
    if (!isValidWhatsAppNumber(customerPhone)) {
      return NextResponse.json({ error: 'Format nomor WhatsApp tidak valid' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Pilih minimal satu layanan' }, { status: 400 })
    }

    const validTypes: BookingType[] = ['wisata', 'toko', 'parkir', 'sewa']
    const bookingType: BookingType = validTypes.includes(payload.type as BookingType)
      ? payload.type as BookingType
      : 'wisata'
    const [tourCatalog, productCatalog] = await Promise.all([
      bookingType === 'toko'
        ? Promise.resolve([] as TourCatalogItem[])
        : loadResolvedTourCatalog().then((result) => result.data),
      bookingType === 'toko'
        ? loadProductCatalog().then((result) => result.data)
        : Promise.resolve([] as ProductCatalogItem[]),
    ])
    const bookingId = generateId()
    const bookingCode = generateBookingCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const accommodationItems = items.filter((item) => item.id && isAccommodationItem(item.id))
    const isStay = accommodationItems.length > 0
    const isRentalVenue = items.some(isRentalVenueItem)
    const accommodationSelections = safeAccommodationSelections(payload.accommodations)
    if (!accommodationSelections) {
      return NextResponse.json({ error: 'Detail akomodasi tidak valid' }, { status: 400 })
    }
    const participantCount = positiveInteger(payload.participantCount || payload.guestCount, 1)
    if (items.some(isEduTripItem) && participantCount < EDU_TRIP_MIN_PARTICIPANTS) {
      return NextResponse.json(
        { error: `Paket Edu Trip membutuhkan minimal ${EDU_TRIP_MIN_PARTICIPANTS} peserta` },
        { status: 400 },
      )
    }
    let rentalDurationHours = 1
    const effectiveBookingDate = payload.bookingDate || payload.checkInDate || null

    if (isRentalVenue) {
      const firstRental = items.find(isRentalVenueItem)
      const startMinutes = (payload.timeStart || firstRental?.timeStart) ? timeToMinutes(payload.timeStart || firstRental?.timeStart || '') : null
      const endMinutes = (payload.timeEnd || firstRental?.timeEnd) ? timeToMinutes(payload.timeEnd || firstRental?.timeEnd || '') : null
      if ((!effectiveBookingDate && !firstRental?.bookingDate) || startMinutes === null || endMinutes === null) {
        return NextResponse.json({ error: 'Tanggal, jam mulai, dan jam selesai sewa wajib diisi' }, { status: 400 })
      }
      if (startMinutes < 7 * 60 || endMinutes > 17 * 60 || endMinutes <= startMinutes) {
        return NextResponse.json({ error: 'Jam sewa harus berada dalam jam operasional 07.00–17.00 WIB' }, { status: 400 })
      }
      const durationInMinutes = endMinutes - startMinutes
      if (durationInMinutes % 60 !== 0) {
        return NextResponse.json({ error: 'Durasi sewa harus dipilih per satu jam' }, { status: 400 })
      }
      rentalDurationHours = durationInMinutes / 60
      for (const item of items.filter(isRentalVenueItem)) {
        const itemStart = item.timeStart || payload.timeStart
        const itemEnd = item.timeEnd || payload.timeEnd
        const itemDate = item.bookingDate || effectiveBookingDate
        const itemStartMinutes = itemStart ? timeToMinutes(itemStart) : null
        const itemEndMinutes = itemEnd ? timeToMinutes(itemEnd) : null
        if (!itemDate || itemStartMinutes === null || itemEndMinutes === null || itemEndMinutes <= itemStartMinutes) {
          return NextResponse.json({ error: `Tanggal dan jam sewa untuk "${item.name}" wajib diisi` }, { status: 400 })
        }
        if (itemStartMinutes < 7 * 60 || itemEndMinutes > 17 * 60 || (itemEndMinutes - itemStartMinutes) % 60 !== 0) {
          return NextResponse.json({ error: 'Jam sewa harus berada dalam jam operasional 07.00â€“17.00 WIB dan dipilih per satu jam' }, { status: 400 })
        }
      }
    }

    let parsedTotal = Math.max(0, Number(payload.totalAmount) || 0)
    let finalItems = items
    let bookingMode: 'standard' | 'stay' | 'edu_trip' = items.some(isEduTripItem) ? 'edu_trip' : 'standard'
    let bookingDate = effectiveBookingDate
    let checkInDate: string | null = null
    let checkOutDate: string | null = null
    let nights: number | null = null
    let accommodationType: 'homestay' | 'camping' | 'glamping' | 'mixed' | null = null
    let documentType: string | null = null
    let pricingDetails: Record<string, unknown> = {}
    const accommodations: Record<string, unknown>[] = []
    const currentArenaTime = arenaNow()

    if (!isStay && bookingDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || bookingDate < currentArenaTime.date) {
        return NextResponse.json({ error: 'Tanggal booking tidak boleh berada di masa lalu' }, { status: 400 })
      }
      const requestedStartMinutes = payload.timeStart ? timeToMinutes(payload.timeStart) : null
      if (bookingDate === currentArenaTime.date && requestedStartMinutes !== null && requestedStartMinutes <= currentArenaTime.minutes) {
        return NextResponse.json({ error: 'Jam booking yang sudah lewat tidak dapat dipilih' }, { status: 400 })
      }
    }

    // Pesanan toko tidak memiliki tanggal layanan. Produk tetap divalidasi
    // terhadap katalog dan harganya di bawah, tetapi tidak boleh dipaksa
    // mengikuti validasi jadwal wisata.
    if (bookingType !== 'toko') {
      for (const item of items.filter((entry) => !entry.id || !isAccommodationItem(entry.id))) {
        const itemDate = item.bookingDate || bookingDate
        if (!itemDate || !/^\d{4}-\d{2}-\d{2}$/.test(itemDate) || itemDate < currentArenaTime.date) {
          return NextResponse.json({ error: `Tanggal booking untuk "${item.name}" tidak valid` }, { status: 400 })
        }
        const itemStart = item.timeStart || payload.timeStart
        const itemStartMinutes = itemStart ? timeToMinutes(itemStart) : null
        if (itemDate === currentArenaTime.date && itemStartMinutes !== null && itemStartMinutes <= currentArenaTime.minutes) {
          return NextResponse.json({ error: `Jam booking untuk "${item.name}" sudah lewat` }, { status: 400 })
        }
      }
    }

    if (isStay) {
      if (!customerAddress) return NextResponse.json({ error: 'Alamat wajib diisi untuk booking penginapan' }, { status: 400 })
      const firstAccommodation = accommodationItems[0]
      const firstAccommodationSelection = accommodationSelections.find((entry) => entry.itemId === firstAccommodation?.id)
      checkInDate = firstAccommodationSelection?.checkInDate || firstAccommodation?.checkInDate || payload.checkInDate || ''
      checkOutDate = firstAccommodationSelection?.checkOutDate || firstAccommodation?.checkOutDate || payload.checkOutDate || ''
      if (!checkInDate || checkInDate < currentArenaTime.date) {
        return NextResponse.json({ error: 'Tanggal check-in tidak boleh berada di masa lalu' }, { status: 400 })
      }
      try {
        nights = differenceInNights(checkInDate, checkOutDate)
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Rentang tanggal tidak valid' }, { status: 400 })
      }
      documentType = payload.documentType || ''
      if (!['ktp', 'kk', 'buku_nikah'].includes(documentType)) {
        return NextResponse.json({ error: 'Pilih tepat satu jenis dokumen: KTP, KK, atau Buku Nikah' }, { status: 400 })
      }
      if (!identityDocument || identityDocument.size === 0) {
        return NextResponse.json({ error: 'Dokumen identitas JPEG wajib diunggah' }, { status: 400 })
      }
      if (identityDocument.type !== 'image/jpeg') {
        return NextResponse.json({ error: 'Dokumen identitas harus berupa JPEG' }, { status: 400 })
      }
      if (identityDocument.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Ukuran dokumen identitas maksimal 5 MB' }, { status: 400 })
      }
      if (!isSupabaseConfigured()) {
        return NextResponse.json(
          { error: 'Supabase harus dikonfigurasi agar dokumen identitas tersimpan secara privat' },
          { status: 503 },
        )
      }

      const selectionIds = new Set(accommodationSelections.map((selection) => selection.itemId))
      const itemIds = new Set(accommodationItems.map((item) => item.id as string))
      if (
        accommodationItems.length !== itemIds.size
        ||
        selectionIds.size !== accommodationSelections.length
        || selectionIds.size !== itemIds.size
        || [...selectionIds].some((id) => !itemIds.has(id))
      ) {
        return NextResponse.json({ error: 'Setiap akomodasi harus memiliki satu detail pilihan' }, { status: 400 })
      }

      const settings = await loadBookingSettings()
      const extraBedPrice = tourCatalog.find((item) => item.id === 'extra-bed')?.price
      const accommodationTypes = new Set<'homestay' | 'camping' | 'glamping'>()
      const breakdowns: Record<string, unknown>[] = []
      let accommodationTotal = 0

      for (const item of accommodationItems) {
        const itemId = item.id as string
        const selection = accommodationSelections.find((entry) => entry.itemId === itemId)
        const service = tourCatalog.find((entry) => entry.id === itemId)
        const type = accommodationTypeForItem(itemId)
        if (!selection || !service || !type) return NextResponse.json({ error: 'Data penginapan tidak valid' }, { status: 400 })
        if (!service.available) return NextResponse.json({ error: 'Penginapan sedang ditutup sementara' }, { status: 409 })
        const requestedCheckInDate: string | null = selection.checkInDate || item.checkInDate || checkInDate
        const requestedCheckOutDate: string | null = selection.checkOutDate || item.checkOutDate || checkOutDate
        if (requestedCheckInDate !== checkInDate || requestedCheckOutDate !== checkOutDate) {
          return NextResponse.json({ error: 'Semua akomodasi dalam satu booking harus memakai tanggal check-in dan check-out yang sama' }, { status: 400 })
        }
        const itemCheckInDate = checkInDate
        const itemCheckOutDate = checkOutDate
        if (!itemCheckInDate || !itemCheckOutDate || itemCheckInDate < currentArenaTime.date) {
          return NextResponse.json({ error: `Rentang tanggal untuk "${service.name}" tidak valid` }, { status: 400 })
        }
        let itemNights: number
        try {
          itemNights = differenceInNights(itemCheckInDate, itemCheckOutDate)
        } catch (error) {
          return NextResponse.json({ error: error instanceof Error ? error.message : `Rentang tanggal untuk "${service.name}" tidak valid` }, { status: 400 })
        }
        const { data: itemHolidayRows, error: itemHolidayError } = await getSupabaseAdmin()
          .from('booking_holiday_dates')
          .select('holiday_date')
          .eq('active', true)
          .gte('holiday_date', itemCheckInDate)
          .lt('holiday_date', itemCheckOutDate)
        if (itemHolidayError) return NextResponse.json({ error: 'Gagal memuat kalender tarif hari libur' }, { status: 500 })
        const itemHolidayDates = (itemHolidayRows || []).map((row) => row.holiday_date)

        accommodationTypes.add(type)
        let nightlyPrice = service.price || 0
        let extraGuestFee = 0
        let addOns: { id: string; name: string; quantity: number; price: number | null }[] = []
        let subtotal = 0
        let details: Record<string, unknown> = {}

        if (type === 'homestay') {
          const base = calculateHomestayBase(itemCheckInDate, itemCheckOutDate, service.price, service.rate_options, itemHolidayDates)
          extraGuestFee = calculateExtraGuestTotal(service.id, selection.guestCount, itemNights, settings)
          if (selection.extraBedQuantity > 0 && (extraBedPrice === undefined || extraBedPrice <= 0)) {
            return NextResponse.json({ error: 'Harga extra bed belum tersedia' }, { status: 409 })
          }
          const extraBedTotal = selection.extraBedQuantity * (extraBedPrice ?? 0)
          if (selection.extraBedQuantity) addOns = [{ id: 'extra-bed', name: 'Extra Bed 100 x 220 cm', quantity: selection.extraBedQuantity, price: extraBedPrice ?? 0 }]
          subtotal = base.baseTotal + extraGuestFee + extraBedTotal
          details = { kind: type, baseTotal: base.baseTotal, extraGuestTotal: extraGuestFee, nightlyPrices: base.nightlyPrices, holidayDates: itemHolidayDates, extraBedTotal, addOns }
        } else if (type === 'camping') {
          const tentSize = selection.tentSize === 'large' ? 'large' : 'small'
          const tentCount = positiveInteger(selection.tentCount, 1)
          const tentOption = selection.tentOption === 'rent' ? 'rent' : 'own'
          const camping = calculateCampingTotal({
            tentSize, tentCount, tentOption, nights: itemNights,
            firewoodPackages: selection.firewoodPackages,
            nestingQuantity: selection.nestingQuantity,
            chairQuantity: selection.chairQuantity,
          }, settings)
          if (camping.unavailablePrices.length) {
            return NextResponse.json({ error: `Harga ${camping.unavailablePrices.join(', ')} belum ditetapkan. Hubungi pengelola atau pilih opsi lain.` }, { status: 409 })
          }
          nightlyPrice = settings[tentSize === 'small' ? 'camping.small_tent_price' : 'camping.large_tent_price'] || 0
          if (selection.firewoodPackages) addOns.push({ id: 'firewood', name: 'Kayu bakar', quantity: selection.firewoodPackages, price: settings['addon.firewood_price'] })
          if (selection.nestingQuantity) addOns.push({ id: 'nesting', name: 'Sewa nesting', quantity: selection.nestingQuantity, price: settings['addon.nesting_price'] })
          if (selection.chairQuantity) addOns.push({ id: 'camping-chair', name: 'Kursi camping', quantity: selection.chairQuantity, price: settings['addon.camping_chair_price'] })
          subtotal = camping.total
          details = { kind: type, tentSize, tentCount, tentOption, ...camping, addOns }
        } else {
          const glampingPrice = settings['camping.glamping_base_price']
          if (glampingPrice === null || glampingPrice === undefined) return NextResponse.json({ error: 'Harga Glamping belum ditetapkan. Hubungi pengelola.' }, { status: 409 })
          nightlyPrice = glampingPrice
          subtotal = glampingPrice * itemNights
          details = { kind: type, nightlyPrice: glampingPrice, baseTotal: subtotal }
        }

        accommodationTotal += subtotal
        breakdowns.push({ itemId, itemName: service.name, guestCount: selection.guestCount, checkInDate: itemCheckInDate, checkOutDate: itemCheckOutDate, nights: itemNights, subtotal, ...details })
        accommodations.push({
          id: generateId(), item_id: service.id, item_name: service.name, accommodation_type: type,
          check_in_date: itemCheckInDate, check_out_date: itemCheckOutDate, nights: itemNights,
          guest_count: selection.guestCount,
          tent_size: type === 'camping' ? (details.tentSize as string) : null,
          tent_count: type === 'camping' ? (details.tentCount as number) : null,
          tent_option: type === 'camping' ? (details.tentOption as string) : null,
          nightly_price: nightlyPrice, extra_guest_fee: extraGuestFee, addons: addOns, total_price: subtotal,
        })
      }

      bookingMode = items.some(isEduTripItem) ? 'edu_trip' : 'stay'
      bookingDate = checkInDate
      accommodationType = accommodationTypes.size > 1 ? 'mixed' : [...accommodationTypes][0]
      pricingDetails = {
        kind: accommodationTypes.size > 1 ? 'mixed' : [...accommodationTypes][0],
        accommodations: breakdowns,
        accommodationTotal,
      }

      uploadedDocumentPath = `${bookingId}/${crypto.randomUUID()}.jpg`
      const bytes = new Uint8Array(await identityDocument.arrayBuffer())
      const { error: uploadError } = await getSupabaseAdmin().storage
        .from('booking-documents')
        .upload(uploadedDocumentPath, bytes, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) {
        console.error('Identity upload error:', uploadError)
        return NextResponse.json({ error: 'Gagal menyimpan dokumen identitas secara privat' }, { status: 500 })
      }
    }

    if (isStay) {
      const mismatchedService = items.find((item) => {
        if (item.id && isAccommodationItem(item.id)) return false
        return Boolean(item.bookingDate && item.bookingDate !== checkInDate)
      })
      if (mismatchedService) {
        return NextResponse.json(
          { error: `Tanggal layanan "${mismatchedService.name}" harus mengikuti tanggal check-in akomodasi` },
          { status: 400 },
        )
      }
    }

    if (!Number.isFinite(parsedTotal)) return NextResponse.json({ error: 'Total booking tidak valid' }, { status: 400 })

    {
      let computedTotal = 0
      const validated: ClientBookingItem[] = []
      for (const item of items) {
        if (item.id && isAccommodationItem(item.id)) {
          const accommodation = accommodations.find((entry) => entry.item_id === item.id)
          if (!accommodation) return NextResponse.json({ error: `Detail akomodasi untuk "${item.name}" tidak valid` }, { status: 400 })
          const price = Number(accommodation.total_price) || 0
          validated.push({ ...item, quantity: 1, price })
          computedTotal += price
          continue
        }
        const price = authoritativeItemPrice(item, tourCatalog, productCatalog)
        if (price === null) {
          return NextResponse.json({ error: `Harga untuk "${item.name}" tidak valid` }, { status: 400 })
        }
        const service = tourCatalog.find((entry) => entry.id === item.id)
        const itemStart = item.timeStart || payload.timeStart
        const itemEnd = item.timeEnd || payload.timeEnd
        const itemStartMinutes = itemStart ? timeToMinutes(itemStart) : null
        const itemEndMinutes = itemEnd ? timeToMinutes(itemEnd) : null
        const itemDurationHours = itemStartMinutes !== null && itemEndMinutes !== null
          ? Math.max(1, (itemEndMinutes - itemStartMinutes) / 60)
          : rentalDurationHours
        const quantity = resolveBookingQuantity({
          isEdu: isEduTripItem(item),
          isRentalVenue: isRentalVenueItem(item),
          venueUnit: service?.unit ?? null,
          clientQuantity: item.quantity,
          participantCount: item.participantCount || participantCount,
          rentalDurationHours: itemDurationHours,
        })
        validated.push({ ...item, quantity, price })
        computedTotal += price * quantity
      }

      if (isRentalVenue) {
        const settings = await loadBookingSettings()
        const rentalChairQuantity = optionalQuantity(payload.rentalChairQuantity)
        const rentalSoundQuantity = payload.rentalSoundSystem === true || payload.rentalSoundSystem === 'true' ? 1 : 0
        const rentalMatQuantity = optionalQuantity(payload.rentalMatQuantity)
        const rentalAddOns: ClientBookingItem[] = []
        const rentalChairPrice = settings['rental.chair_price']
        const rentalSoundPrice = settings['rental.sound_system_price']
        const rentalMatPrice = settings['rental.mat_price']
        const unavailableRentalAddOns = [
          rentalChairQuantity > 0 && (rentalChairPrice === null || rentalChairPrice === undefined) ? 'kursi' : null,
          rentalSoundQuantity > 0 && (rentalSoundPrice === null || rentalSoundPrice === undefined) ? 'sound system' : null,
          rentalMatQuantity > 0 && (rentalMatPrice === null || rentalMatPrice === undefined) ? 'tikar' : null,
        ].filter(Boolean)
        if (unavailableRentalAddOns.length > 0) {
          return NextResponse.json(
            { error: `Harga add-on ${unavailableRentalAddOns.join(', ')} belum tersedia` },
            { status: 409 },
          )
        }
        if (rentalChairQuantity > 0) {
          rentalAddOns.push({
            id: 'rental-addon-chair',
            name: 'Sewa Kursi',
            category: 'rental-addon',
            quantity: rentalChairQuantity,
            price: rentalChairPrice as number,
          })
        }
        if (rentalSoundQuantity > 0) {
          rentalAddOns.push({
            id: 'rental-addon-sound',
            name: 'Sewa Sound System',
            category: 'rental-addon',
            quantity: rentalSoundQuantity,
            price: rentalSoundPrice as number,
          })
        }
        if (rentalMatQuantity > 0) {
          rentalAddOns.push({
            id: 'rental-addon-mat',
            name: 'Sewa Tikar',
            category: 'rental-addon',
            quantity: rentalMatQuantity,
            price: rentalMatPrice as number,
          })
        }
        const rentalAddOnTotal = rentalAddOns.reduce(
          (sum, item) => sum + item.price * (item.quantity ?? 1),
          0,
        )
        computedTotal += rentalAddOnTotal
        validated.push(...rentalAddOns)
        pricingDetails = {
          ...pricingDetails,
          // Booking campuran (menginap + sewa venue): pertahankan kind akomodasi.
          kind: pricingDetails.kind || 'rental',
          durationHours: rentalDurationHours,
          addOnTotal: rentalAddOnTotal,
          addOns: rentalAddOns,
        }
      }
      finalItems = validated
      parsedTotal = computedTotal
    }

    const reservableItems = finalItems.filter((item) => item.category !== 'rental-addon' && !(item.id && isAccommodationItem(item.id)))
    const conflictError = await checkRentalAvailability(reservableItems, bookingDate || undefined, payload.timeStart, payload.timeEnd)
    if (conflictError) return NextResponse.json({ error: conflictError }, { status: 409 })

    const bookingNotes = [
      participantCount ? `Jumlah peserta: ${participantCount} orang` : '',
      notes,
    ].filter(Boolean).join('\n')
    const bookingData = {
      id: bookingId,
      type: bookingType,
      booking_code: bookingCode,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      customer_address: customerAddress || null,
      event_name: eventName || null,
      booking_date: bookingDate,
      time_start: payload.timeStart || null,
      time_end: payload.timeEnd || null,
      items: finalItems,
      total_amount: parsedTotal,
      status: 'pending',
      payment_status: 'unpaid',
      notes: bookingNotes || null,
      expires_at: expiresAt,
      booking_mode: bookingMode,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      nights,
      guest_count: isStay
        ? accommodations.reduce((sum, accommodation) => sum + positiveInteger(accommodation.guest_count, 1), 0)
        : participantCount,
      accommodation_type: accommodationType,
      document_type: documentType,
      document_storage_path: uploadedDocumentPath,
      pricing_details: pricingDetails,
      edu_trip_dates: [...new Set(items
        .filter(isEduTripItem)
        .map((item) => item.bookingDate || bookingDate)
        .filter((date): date is string => Boolean(date)))],
    }

    if (!isSupabaseConfigured()) {
      const now = new Date().toISOString()
      return NextResponse.json({
        bookingId,
        bookingCode,
        expiresAt,
        totalAmount: parsedTotal,
        status: 'confirmed',
        paymentStatus: 'unpaid',
        paymentUrl: null,
        local: true,
        booking: { ...bookingData, status: 'confirmed', created_at: now, updated_at: now },
        info: 'Booking tersimpan pada perangkat untuk mode localhost',
      })
    }

    // Snapshot booking yang sama dengan branch localhost, agar invoice dapat
    // dirender offline dari localStorage saat jaringan bermasalah.
    const bookingResponse = (status: string, paymentStatus: string) => ({
      ...bookingData,
      status,
      payment_status: paymentStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const supabase = getSupabaseAdmin()
    const ipKey = clientIp(request)
    const { data: creationCount } = await supabase.rpc('record_booking_create_attempt', {
      p_id_key: ipKey,
    })
    // RPC gagal (migrasi belum jalan) tidak memblokir booking — batasan hanya
    // aktif bila fungsi tersedia.
    if (typeof creationCount === 'number' && creationCount > MAX_CREATE_PER_IP) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan membuat booking dari perangkat ini. Silakan coba lagi beberapa saat.' },
        { status: 429 },
      )
    }
    // Anti slot-hold spam: satu nomor maksimal 3 booking pending aktif.
    // Berbasis DB sehingga tetap otoritatif lintas instance serverless.
    const { data: pendingRows } = await supabase
      .from('bookings')
      .select('customer_phone')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
    const pendingCount = (pendingRows || []).filter(
      (row) => digits(row.customer_phone) === digits(customerPhone),
    ).length
    if (pendingCount >= MAX_PENDING_PER_PHONE) {
      return NextResponse.json(
        { error: 'Terlalu banyak booking yang belum dibayar. Selesaikan pembayaran atau batalkan booking sebelumnya.' },
        { status: 429 },
      )
    }
    const rentals = rentalEntries(reservableItems, bookingId, bookingDate || undefined, payload.timeStart, payload.timeEnd)
    const { error: reservationError } = await supabase.rpc('reserve_booking', {
      p_booking: bookingData,
      p_rentals: rentals,
      p_accommodations: accommodations,
      p_is_edu_trip: bookingMode === 'edu_trip',
    })
    if (reservationError) {
      console.error('Reserve booking error:', reservationError)
      if (uploadedDocumentPath) {
        await supabase.storage.from('booking-documents').remove([uploadedDocumentPath])
        uploadedDocumentPath = null
      }
      const friendly = rpcErrorMessage(reservationError.message)
      return NextResponse.json({ error: friendly.message }, { status: friendly.status })
    }

    // Email konfirmasi booking (best-effort, tidak memblokir respons).
    if (customerEmail) {
      sendBookingCreated(bookingId).catch(() => undefined)
    }

    // Booking sukses tidak dihitung sebagai percobaan mencurigakan — reset
    // counter IP agar user sah yang membuat banyak booking tidak terblokir.
    // Anti-spam tetap bekerja: kegagalan (kuota penuh / 409) terus terakumulasi
    // per window 15 menit.
    try {
      await supabase.from('booking_create_attempts').delete().eq('id_key', ipKey)
    } catch { /* reset counter best-effort */ }

    if (parsedTotal > 0 && isMidtransConfigured()) {
      try {
        const snap = await createSnapTransaction({
          orderId: bookingId,
          grossAmount: parsedTotal,
          customerName,
          customerEmail: customerEmail || undefined,
          customerPhone,
          items: finalItems.map((item) => ({
            id: item.id || `item-${crypto.randomUUID()}`,
            name: item.name,
            quantity: item.quantity || 1,
            price: item.price,
          })),
        })
        await supabase
          .from('bookings')
          .update({
            payment_url: snap.redirect_url,
            midtrans_status: 'pending',
            payment_last_checked_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
        return NextResponse.json({
          bookingId,
          bookingCode,
          expiresAt,
          totalAmount: parsedTotal,
          status: 'pending',
          paymentStatus: 'unpaid',
          snapToken: snap.token,
          paymentUrl: snap.redirect_url,
          booking: bookingResponse('pending', 'unpaid'),
        })
      } catch (paymentError) {
        console.error('Payment error:', paymentError)
        return NextResponse.json({
          bookingId,
          bookingCode,
          expiresAt,
          totalAmount: parsedTotal,
          status: 'pending',
          paymentStatus: 'unpaid',
          snapToken: null,
          paymentUrl: null,
          booking: bookingResponse('pending', 'unpaid'),
          info: 'Booking berhasil tetapi pembayaran bermasalah. Silakan buka kembali keranjang untuk melanjutkan pembayaran.',
        })
      }
    }

    if (parsedTotal > 0) {
      return NextResponse.json({
        bookingId,
        bookingCode,
        expiresAt,
        totalAmount: parsedTotal,
        status: 'pending',
        paymentStatus: 'unpaid',
        paymentUrl: null,
        booking: bookingResponse('pending', 'unpaid'),
        info: 'Booking menunggu pembayaran dan belum masuk jadwal aktif.',
      })
    }

    await supabase
      .from('bookings')
      .update({ status: 'confirmed', payment_status: 'paid' })
      .eq('id', bookingId)
    return NextResponse.json({
      bookingId,
      bookingCode,
      expiresAt,
      totalAmount: parsedTotal,
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentUrl: null,
      booking: bookingResponse('confirmed', 'paid'),
    })
  } catch (error) {
    if (uploadedDocumentPath && isSupabaseConfigured()) {
      await getSupabaseAdmin().storage.from('booking-documents').remove([uploadedDocumentPath]).catch(() => undefined)
    }
    console.error('Booking error:', error)
    return NextResponse.json({ error: 'Gagal memproses booking. Silakan coba lagi.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth) return auth

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const paymentStatus = searchParams.get('payment_status')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  if (!isSupabaseConfigured()) return NextResponse.json([])
  try {
    const supabase = getSupabaseAdmin()
    await supabase.rpc('expire_stale_booking_holds')
    let query = supabase.from('bookings').select('*').order('created_at', { ascending: false })
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (paymentStatus) query = query.eq('payment_status', paymentStatus)
    if (startDate) query = query.gte('booking_date', startDate)
    if (endDate) query = query.lte('booking_date', endDate)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Gagal memuat data booking' }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
