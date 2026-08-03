export type BookingSettingMap = Record<string, number | null>

export const DEFAULT_BOOKING_SETTINGS: BookingSettingMap = {
  'camping.small_tent_price': 20_000,
  'camping.large_tent_price': 50_000,
  'camping.tent_rental_price': null,
  'camping.small_tent_rental_price': 20_000,
  'camping.large_tent_rental_price': 50_000,
  'camping.glamping_base_price': null,
  'addon.firewood_price': 25_000,
  'addon.nesting_price': 50_000,
  'addon.camping_chair_price': 10_000,
  'rental.chair_price': 3_000,
  'rental.sound_system_price': 300_000,
  'rental.mat_price': 10_000,
  'homestay.aren_1.base_capacity': 5,
  'homestay.aren_2.base_capacity': 5,
  'homestay.aren_1.extra_guest_fee': 10_000,
  'homestay.aren_2.extra_guest_fee': 10_000,
  'edu_trip.daily_quota': 2,
}

export const ACCOMMODATION_ITEM_IDS = [
  'aren-1',
  'aren-2',
  'aren-3',
  'aren-4',
  'camping-ground',
  'glamping',
] as const

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function parseDateOnly(value: string): Date {
  if (!DATE_ONLY.test(value)) throw new Error('Format tanggal tidak valid')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Tanggal tidak valid')
  }
  return date
}

export function addDateDays(value: string, days: number): string {
  const date = parseDateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function differenceInNights(checkIn: string, checkOut: string): number {
  const milliseconds = parseDateOnly(checkOut).getTime() - parseDateOnly(checkIn).getTime()
  const nights = milliseconds / 86_400_000
  if (!Number.isInteger(nights) || nights < 1) {
    throw new Error('Check-out minimal satu malam setelah check-in')
  }
  return nights
}

export function stayDateKeys(checkIn: string, checkOut: string): string[] {
  const nights = differenceInNights(checkIn, checkOut)
  return Array.from({ length: nights }, (_, index) => addDateDays(checkIn, index))
}

export function isAccommodationItem(itemId: string): boolean {
  return (ACCOMMODATION_ITEM_IDS as readonly string[]).includes(itemId)
}

export function accommodationTypeForItem(itemId: string): 'homestay' | 'camping' | 'glamping' | null {
  if (itemId.startsWith('aren-')) return 'homestay'
  if (itemId === 'camping-ground') return 'camping'
  if (itemId === 'glamping') return 'glamping'
  return null
}

export function isEduTripItem(item: { id?: string; category?: string }): boolean {
  return item.category === 'paket-edukasi' || Boolean(item.id?.startsWith('edu-trip-'))
}

interface RateOption {
  label: string
  price: number
}

export interface HomestayPriceBreakdown {
  nights: number
  baseTotal: number
  weekdayNights: number
  weekendNights: number
  holidayNights: number
  nightlyPrices: { date: string; rate: 'Weekday' | 'Weekend' | 'Holiday'; price: number }[]
}

export function calculateHomestayBase(
  checkIn: string,
  checkOut: string,
  fallbackPrice: number,
  rates: RateOption[] = [],
  holidayDates: readonly string[] = [],
): HomestayPriceBreakdown {
  const rateMap = new Map(rates.map((rate) => [rate.label.toLowerCase(), Number(rate.price)]))
  const holidaySet = new Set(holidayDates)
  const nightlyPrices = stayDateKeys(checkIn, checkOut).map((dateKey) => {
    const day = parseDateOnly(dateKey).getUTCDay()
    const isHoliday = holidaySet.has(dateKey)
    const isWeekend = day === 0 || day === 6
    const rate: 'Weekday' | 'Weekend' | 'Holiday' = isHoliday
      ? 'Holiday'
      : isWeekend
        ? 'Weekend'
        : 'Weekday'
    const price = rateMap.get(rate.toLowerCase()) ?? fallbackPrice
    return { date: dateKey, rate, price }
  })

  return {
    nights: nightlyPrices.length,
    baseTotal: nightlyPrices.reduce((sum, night) => sum + night.price, 0),
    weekdayNights: nightlyPrices.filter((night) => night.rate === 'Weekday').length,
    weekendNights: nightlyPrices.filter((night) => night.rate === 'Weekend').length,
    holidayNights: nightlyPrices.filter((night) => night.rate === 'Holiday').length,
    nightlyPrices,
  }
}

export function calculateExtraGuestTotal(
  itemId: string,
  guestCount: number,
  nights: number,
  settings: BookingSettingMap = DEFAULT_BOOKING_SETTINGS,
): number {
  if (itemId !== 'aren-1' && itemId !== 'aren-2') return 0
  const settingPrefix = itemId.replace('-', '_')
  const capacity = settings[`homestay.${settingPrefix}.base_capacity`] ?? 5
  const fee = settings[`homestay.${settingPrefix}.extra_guest_fee`] ?? 10_000
  return Math.max(0, guestCount - capacity) * fee * nights
}

export interface CampingCalculationInput {
  tentSize: 'small' | 'large'
  tentCount: number
  tentOption: 'own' | 'rent'
  nights: number
  firewoodPackages?: number
  nestingQuantity?: number
  chairQuantity?: number
}

export interface CampingPriceBreakdown {
  groundTotal: number
  rentalTotal: number
  addOnTotal: number
  total: number
  unavailablePrices: string[]
}

export function calculateCampingTotal(
  input: CampingCalculationInput,
  settings: BookingSettingMap = DEFAULT_BOOKING_SETTINGS,
): CampingPriceBreakdown {
  if (input.tentCount < 1 || input.nights < 1) throw new Error('Jumlah tenda dan malam minimal satu')
  const tentPriceKey = input.tentSize === 'small'
    ? 'camping.small_tent_price'
    : 'camping.large_tent_price'
  const tentPrice = settings[tentPriceKey]
  if (tentPrice === null || tentPrice === undefined) throw new Error('Harga camping belum tersedia')

  const unavailablePrices: string[] = []
  const groundTotal = tentPrice * input.tentCount * input.nights
  let rentalTotal = 0
  if (input.tentOption === 'rent') {
    const rentalPriceKey = input.tentSize === 'small'
      ? 'camping.small_tent_rental_price'
      : 'camping.large_tent_rental_price'
    const rentalPrice = settings[rentalPriceKey] ?? settings['camping.tent_rental_price']
    if (rentalPrice === null || rentalPrice === undefined) {
      unavailablePrices.push('Sewa tenda')
    } else {
      rentalTotal = rentalPrice * input.tentCount * input.nights
    }
  }

  let addOnTotal = 0
  const addOns: [string, number, string][] = [
    ['addon.firewood_price', input.firewoodPackages || 0, 'Kayu bakar'],
    ['addon.nesting_price', input.nestingQuantity || 0, 'Sewa nesting'],
    ['addon.camping_chair_price', input.chairQuantity || 0, 'Sewa kursi camping'],
  ]
  for (const [key, quantity, label] of addOns) {
    if (quantity < 1) continue
    const price = settings[key]
    if (price === null || price === undefined) unavailablePrices.push(label)
    else addOnTotal += price * quantity
  }

  return {
    groundTotal,
    rentalTotal,
    addOnTotal,
    total: groundTotal + rentalTotal + addOnTotal,
    unavailablePrices,
  }
}

export function dateRangeContainsBlockedDate(
  checkIn: string,
  checkOut: string,
  blockedDates: readonly string[],
): boolean {
  const blocked = new Set(blockedDates)
  return stayDateKeys(checkIn, checkOut).some((date) => blocked.has(date))
}
