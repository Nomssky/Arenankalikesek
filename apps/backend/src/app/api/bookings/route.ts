import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase-server'
import { createSnapTransaction, isMidtransConfigured } from '../../../lib/midtrans'
import { sendBookingCreated } from '../../../lib/email'
import { digits, generateId, timeToMinutes } from '../../../lib/utils'
import { requireAdmin } from '../../../lib/admin-guard'
import { loadBookingSettings } from '../../../lib/booking-settings'
import { loadProductCatalog, loadResolvedTourCatalog } from '../../../lib/catalog'
import {
  accommodationTypeForItem,
  calculateCampingTotal,
  calculateExtraGuestTotal,
  calculateHomestayBase,
  differenceInNights,
  isAccommodationItem,
  isEduTripItem,
} from '@repo/shared-utils'
import type { BookingType } from '@repo/shared-types'

interface ClientBookingItem {
  id?: string
  name: string
  category?: string
  quantity?: number
  price: number
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
const RENTAL_VENUE_CATEGORIES = new Set(['area-kegiatan', 'tempat-pertemuan'])

function isRentalVenueItem(item: ClientBookingItem) {
  return Boolean(item.category && RENTAL_VENUE_CATEGORIES.has(item.category))
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
  let items: unknown
  try {
    items = JSON.parse(rawItems)
  } catch {
    throw new Error('Data item booking tidak valid')
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

function timeOverlaps(
  newStart: string,
  newEnd: string | undefined,
  existingStart: string | null,
  existingEnd: string | null,
): boolean {
  if (!existingStart) return true
  const newStartMinutes = timeToMinutes(newStart)
  const newEndMinutes = newEnd ? timeToMinutes(newEnd) : null
  const existingStartMinutes = timeToMinutes(existingStart)
  const existingEndMinutes = existingEnd ? timeToMinutes(existingEnd) : null
  if (newStartMinutes === null || existingStartMinutes === null) return true
  const normalizedNewEnd = newEndMinutes ?? newStartMinutes + 60
  const normalizedExistingEnd = existingEndMinutes ?? existingStartMinutes + 60
  return newStartMinutes < normalizedExistingEnd && normalizedNewEnd > existingStartMinutes
}

async function checkRentalAvailability(
  items: ClientBookingItem[],
  bookingDate?: string,
  timeStart?: string,
  timeEnd?: string,
): Promise<string | null> {
  if (!isSupabaseConfigured() || !bookingDate || !items.length) return null
  const supabase = getSupabaseAdmin()
  for (const item of items) {
    if (!item.id) continue
    const { data: conflicts, error } = await supabase
      .from('rental_bookings')
      .select('time_start, time_end')
      .eq('item_id', item.id)
      .eq('booking_date', bookingDate)
      .in('status', ['hold', 'active'])
    if (error) return 'Ketersediaan jadwal gagal diperiksa. Silakan muat ulang dan pilih jadwal kembali.'
    if (!conflicts?.length) continue
    if (!timeStart || conflicts.some((row) => !row.time_start || timeOverlaps(timeStart, timeEnd, row.time_start, row.time_end))) {
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
  if (!bookingDate) return []
  const startAt = timeStart ? `${bookingDate}T${timeStart}:00+07:00` : `${bookingDate}T00:00:00+07:00`
  const endAt = timeEnd ? `${bookingDate}T${timeEnd}:00+07:00` : `${bookingDate}T23:59:00+07:00`
  return items.map((item) => ({
    id: generateId(),
    booking_id: bookingId,
    item_id: item.id || `item-${crypto.randomUUID()}`,
    item_name: item.name,
    quantity: item.quantity || 1,
    booking_date: bookingDate,
    time_start: timeStart || null,
    time_end: timeEnd || null,
    start_at: startAt,
    end_at: endAt,
    total_price: item.price * (item.quantity || 1),
  }))
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
    const accommodationItem = items.find((item) => item.id && isAccommodationItem(item.id))
    const isStay = Boolean(accommodationItem)
    const isRentalVenue = items.some(isRentalVenueItem)
    const participantCount = positiveInteger(payload.participantCount || payload.guestCount, 1)
    let rentalDurationHours = 1

    if (isRentalVenue) {
      const startMinutes = payload.timeStart ? timeToMinutes(payload.timeStart) : null
      const endMinutes = payload.timeEnd ? timeToMinutes(payload.timeEnd) : null
      if (!payload.bookingDate || startMinutes === null || endMinutes === null) {
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
    }

    let parsedTotal = Math.max(0, Number(payload.totalAmount) || 0)
    let finalItems = items
    let bookingMode: 'standard' | 'stay' | 'edu_trip' = items.some(isEduTripItem) ? 'edu_trip' : 'standard'
    let bookingDate = payload.bookingDate || null
    let checkInDate: string | null = null
    let checkOutDate: string | null = null
    let nights: number | null = null
    let accommodationType: 'homestay' | 'camping' | 'glamping' | null = null
    let documentType: string | null = null
    let pricingDetails: Record<string, unknown> = {}
    let accommodations: Record<string, unknown>[] = []
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

    if (isStay && accommodationItem?.id) {
      if (items.filter((item) => item.id && isAccommodationItem(item.id)).length !== 1) {
        return NextResponse.json({ error: 'Satu transaksi hanya dapat memuat satu unit penginapan' }, { status: 400 })
      }
      if (!customerAddress) return NextResponse.json({ error: 'Alamat wajib diisi untuk booking penginapan' }, { status: 400 })
      checkInDate = payload.checkInDate || ''
      checkOutDate = payload.checkOutDate || ''
      if (checkInDate < currentArenaTime.date) {
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

      const service = tourCatalog.find((item) => item.id === accommodationItem.id)
      accommodationType = accommodationTypeForItem(accommodationItem.id)
      if (!service || !accommodationType) {
        return NextResponse.json({ error: 'Data penginapan tidak valid' }, { status: 400 })
      }
      const settings = await loadBookingSettings()
      const guestCount = positiveInteger(payload.guestCount, 1)
      const addOns: { id: string; name: string; quantity: number; price: number | null }[] = []
      let nightlyPrice = service.price || 0
      let extraGuestFee = 0

      if (accommodationType === 'homestay') {
        const { data: holidayRows, error: holidayError } = await getSupabaseAdmin()
          .from('booking_holiday_dates')
          .select('holiday_date')
          .eq('active', true)
          .gte('holiday_date', checkInDate)
          .lt('holiday_date', checkOutDate)
        if (holidayError) {
          return NextResponse.json({ error: 'Gagal memuat kalender tarif hari libur' }, { status: 500 })
        }
        const holidayDates = (holidayRows || []).map((row) => row.holiday_date)
        const base = calculateHomestayBase(checkInDate, checkOutDate, service.price, service.rate_options, holidayDates)
        extraGuestFee = calculateExtraGuestTotal(service.id, guestCount, nights, settings)
        const extraBedQuantity = optionalQuantity(payload.extraBedQuantity)
        const extraBedPrice = tourCatalog.find((item) => item.id === 'extra-bed')?.price
        if (extraBedQuantity > 0 && (extraBedPrice === undefined || extraBedPrice <= 0)) {
          return NextResponse.json({ error: 'Harga extra bed belum tersedia' }, { status: 409 })
        }
        const extraBedTotal = extraBedQuantity * (extraBedPrice ?? 0)
        if (extraBedQuantity) addOns.push({ id: 'extra-bed', name: 'Extra Bed 100 × 220 cm', quantity: extraBedQuantity, price: extraBedPrice ?? 0 })
        parsedTotal = base.baseTotal + extraGuestFee + extraBedTotal
        pricingDetails = {
          kind: 'homestay',
          baseTotal: base.baseTotal,
          extraGuestTotal: extraGuestFee,
          nightlyPrices: base.nightlyPrices,
          holidayDates,
          extraBedTotal,
          addOns,
          holidayNotice: 'Tarif Holiday mengikuti tanggal yang ditetapkan admin.',
        }
      } else if (accommodationType === 'camping') {
        const tentSize = payload.tentSize === 'large' ? 'large' : 'small'
        const tentCount = positiveInteger(payload.tentCount, 1)
        const tentOption = payload.tentOption === 'rent' ? 'rent' : 'own'
        const firewoodPackages = optionalQuantity(payload.firewoodPackages)
        const nestingQuantity = optionalQuantity(payload.nestingQuantity)
        const chairQuantity = optionalQuantity(payload.chairQuantity)
        const camping = calculateCampingTotal(
          { tentSize, tentCount, tentOption, nights, firewoodPackages, nestingQuantity, chairQuantity },
          settings,
        )
        if (camping.unavailablePrices.length) {
          return NextResponse.json(
            { error: `Harga ${camping.unavailablePrices.join(', ')} belum ditetapkan. Hubungi pengelola atau pilih opsi lain.` },
            { status: 409 },
          )
        }
        nightlyPrice = settings[tentSize === 'small' ? 'camping.small_tent_price' : 'camping.large_tent_price'] || 0
        if (firewoodPackages) addOns.push({ id: 'firewood', name: 'Kayu bakar', quantity: firewoodPackages, price: settings['addon.firewood_price'] })
        if (nestingQuantity) addOns.push({ id: 'nesting', name: 'Sewa nesting', quantity: nestingQuantity, price: settings['addon.nesting_price'] })
        if (chairQuantity) addOns.push({ id: 'camping-chair', name: 'Kursi camping', quantity: chairQuantity, price: settings['addon.camping_chair_price'] })
        parsedTotal = camping.total
        pricingDetails = {
          kind: 'camping', tentSize, tentCount, tentOption, ...camping, addOns,
        }
      } else {
        const glampingPrice = settings['camping.glamping_base_price']
        if (glampingPrice === null || glampingPrice === undefined) {
          return NextResponse.json({ error: 'Harga Glamping belum ditetapkan. Hubungi pengelola.' }, { status: 409 })
        }
        nightlyPrice = glampingPrice
        parsedTotal = glampingPrice * nights
        pricingDetails = { kind: 'glamping', nightlyPrice: glampingPrice, baseTotal: parsedTotal }
      }

      bookingMode = 'stay'
      bookingDate = checkInDate
      finalItems = [{
        id: service.id,
        name: service.name,
        category: service.category,
        quantity: 1,
        price: parsedTotal,
      }]

      uploadedDocumentPath = `${bookingId}/${crypto.randomUUID()}.jpg`
      const bytes = new Uint8Array(await identityDocument.arrayBuffer())
      const { error: uploadError } = await getSupabaseAdmin().storage
        .from('booking-documents')
        .upload(uploadedDocumentPath, bytes, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) {
        console.error('Identity upload error:', uploadError)
        return NextResponse.json({ error: 'Gagal menyimpan dokumen identitas secara privat' }, { status: 500 })
      }

      accommodations = [{
        id: generateId(),
        item_id: service.id,
        item_name: service.name,
        accommodation_type: accommodationType,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        nights,
        guest_count: guestCount,
        tent_size: accommodationType === 'camping' ? (pricingDetails.tentSize as string) : null,
        tent_count: accommodationType === 'camping' ? (pricingDetails.tentCount as number) : null,
        tent_option: accommodationType === 'camping' ? (pricingDetails.tentOption as string) : null,
        nightly_price: nightlyPrice,
        extra_guest_fee: extraGuestFee,
        addons: addOns,
        total_price: parsedTotal,
      }]
    }

    if (!Number.isFinite(parsedTotal)) return NextResponse.json({ error: 'Total booking tidak valid' }, { status: 400 })

    if (!isStay) {
      let computedTotal = 0
      const validated: ClientBookingItem[] = []
      for (const item of items) {
        const price = authoritativeItemPrice(item, tourCatalog, productCatalog)
        if (price === null) {
          return NextResponse.json({ error: `Harga untuk "${item.name}" tidak valid` }, { status: 400 })
        }
        const quantity = isRentalVenueItem(item) ? rentalDurationHours : item.quantity ?? 1
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
          kind: 'rental',
          durationHours: rentalDurationHours,
          addOnTotal: rentalAddOnTotal,
          addOns: rentalAddOns,
        }
      }
      finalItems = validated
      parsedTotal = computedTotal
    }

    const reservableItems = finalItems.filter((item) => item.category !== 'rental-addon')
    const conflictError = isStay ? null : await checkRentalAvailability(reservableItems, bookingDate || undefined, payload.timeStart, payload.timeEnd)
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
      time_start: isStay ? null : payload.timeStart || null,
      time_end: isStay ? null : payload.timeEnd || null,
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
      guest_count: isStay ? positiveInteger(payload.guestCount, 1) : participantCount,
      accommodation_type: accommodationType,
      document_type: documentType,
      document_storage_path: uploadedDocumentPath,
      pricing_details: pricingDetails,
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

    const supabase = getSupabaseAdmin()
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
    const rentals = isStay
      ? []
      : rentalEntries(reservableItems, bookingId, bookingDate || undefined, payload.timeStart, payload.timeEnd)
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
    })
  } catch (error) {
    if (uploadedDocumentPath && isSupabaseConfigured()) {
      await getSupabaseAdmin().storage.from('booking-documents').remove([uploadedDocumentPath]).catch(() => undefined)
    }
    console.error('Booking error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
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
