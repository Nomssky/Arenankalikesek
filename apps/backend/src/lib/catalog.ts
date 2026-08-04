import {
  formatRupiah,
  type PricingType,
} from '@repo/shared-utils'
import {
  fallbackProducts,
  fallbackTourPackages,
  type FallbackProduct,
  type FallbackTourPackage,
} from './fallback-data'
import { loadBookingSettings } from './booking-settings'
import {
  inventoryPriceLabel,
  inventoryUnit,
  inventoryVenues,
  RENTAL_VENUE_CATEGORIES,
} from './inventory'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase-server'

interface TourPackageRow {
  id: string
  name: string
  category: string
  price: number | string | null
  max_price: number | string | null
  capacity: string | null
  note: string | null
  image: string | null
  available: boolean | null
  sort_order: number | null
}

interface ProductRow {
  id: string
  name: string
  price: number | string | null
  category: string
  image: string | null
  description: string | null
  unit: string | null
  available: boolean | null
  sort_order: number | null
}

export type CatalogSource = 'database' | 'fallback'

export interface CatalogResult<T> {
  data: T[]
  source: CatalogSource
}

export interface ResolvedTourCatalog {
  data: FallbackTourPackage[]
  source: string
}

function normalizedName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function safePrice(value: number | string | null | undefined) {
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 ? price : 0
}

function tourPricingType(
  row: TourPackageRow,
  fallback: FallbackTourPackage | undefined,
  price: number,
  maxPrice: number | null,
): PricingType {
  if (row.category === 'gratis') return 'free'
  if (maxPrice !== null && maxPrice > price) return 'range'
  if (price > 0) return 'fixed'
  if (fallback?.pricing_type === 'free') return 'free'
  if (fallback?.pricing_type === 'market') return 'market'
  return 'contact'
}

function tourPriceLabel(price: number, maxPrice: number | null, pricingType: PricingType) {
  if (pricingType === 'free') return 'Gratis'
  if (pricingType === 'contact' || pricingType === 'market') return 'Hubungi pengelola'
  if (pricingType === 'range' && maxPrice !== null) {
    return `${formatRupiah(price)}–${formatRupiah(maxPrice)}`
  }
  return formatRupiah(price)
}

export function mapTourPackageRow(row: TourPackageRow): FallbackTourPackage {
  const fallback = fallbackTourPackages.find(
    (item) => normalizedName(item.name) === normalizedName(row.name),
  )
  const price = safePrice(row.price)
  const rawMaxPrice = row.max_price === null || row.max_price === undefined
    ? null
    : safePrice(row.max_price)
  const maxPrice = rawMaxPrice !== null && rawMaxPrice >= price ? rawMaxPrice : null
  const pricingType = tourPricingType(row, fallback, price, maxPrice)
  const unit = fallback?.unit ?? null
  const available = row.available ?? true

  return {
    id: fallback?.id ?? String(row.id),
    name: row.name,
    category: row.category,
    price,
    max_price: maxPrice,
    price_label: tourPriceLabel(price, maxPrice, pricingType),
    pricing_type: pricingType,
    unit,
    capacity: row.capacity ?? fallback?.capacity ?? null,
    note: row.note ?? fallback?.note ?? null,
    facilities: fallback?.facilities ?? [],
    // Tarif publik tidak boleh memakai rincian harga statis saat database hanya
    // menyimpan harga dasar/maksimum. Booking memakai harga dasar database.
    rate_options: [],
    image: row.image || fallback?.image || '',
    available,
    bookable: available && !['contact', 'market'].includes(pricingType),
    sort_order: row.sort_order ?? fallback?.sort_order ?? 0,
  }
}

export function mapProductRow(row: ProductRow): FallbackProduct {
  const fallback = fallbackProducts.find(
    (item) => normalizedName(item.name) === normalizedName(row.name),
  )
  const price = safePrice(row.price)
  const available = row.available ?? true
  const unit = row.unit ?? fallback?.unit ?? ''

  return {
    id: fallback?.id ?? String(row.id),
    name: row.name,
    price,
    price_label: price > 0 ? formatRupiah(price) : 'Hubungi pengelola',
    category: row.category,
    image: row.image || fallback?.image || '',
    description: row.description ?? fallback?.description ?? '',
    unit,
    available,
    purchasable: available && price > 0,
    sort_order: row.sort_order ?? fallback?.sort_order ?? 0,
  }
}

export async function loadTourCatalog(): Promise<CatalogResult<FallbackTourPackage>> {
  if (!isSupabaseConfigured()) {
    return { data: fallbackTourPackages, source: 'fallback' }
  }

  const { data, error } = await getSupabaseAdmin()
    .from('tour_packages')
    .select('id,name,category,price,max_price,capacity,note,image,available,sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Gagal memuat harga paket dari database: ${error.message}`)
  return {
    data: (data || []).map((row) => mapTourPackageRow(row as TourPackageRow)),
    source: 'database',
  }
}

export async function loadProductCatalog(): Promise<CatalogResult<FallbackProduct>> {
  if (!isSupabaseConfigured()) {
    return { data: fallbackProducts, source: 'fallback' }
  }

  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('id,name,price,category,image,description,unit,available,sort_order')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`Gagal memuat harga produk dari database: ${error.message}`)
  return {
    data: (data || []).map((row) => mapProductRow(row as ProductRow)),
    source: 'database',
  }
}

export async function loadResolvedTourCatalog(): Promise<ResolvedTourCatalog> {
  const [catalog, settings, liveVenues] = await Promise.all([
    loadTourCatalog(),
    loadBookingSettings(),
    inventoryVenues(),
  ])
  const baseItems = catalog.source === 'database'
    ? catalog.data.filter((item) => !RENTAL_VENUE_CATEGORIES.includes(item.category))
    : [...catalog.data]

  for (const live of liveVenues) {
    const fallback = fallbackTourPackages.find((item) => item.id === live.id)
    baseItems.push({
      ...(fallback ?? {
        id: live.id,
        name: live.name,
        category: live.category,
        price: live.price,
        max_price: null,
        price_label: inventoryPriceLabel(live),
        pricing_type: 'fixed' as const,
        unit: inventoryUnit(live.price_type),
        capacity: null,
        note: null,
        facilities: [],
        rate_options: [],
        image: live.image || '',
        available: live.available,
        bookable: live.available,
        sort_order: baseItems.length + 1,
      }),
      name: live.name,
      category: live.category,
      price: live.price,
      max_price: null,
      price_label: inventoryPriceLabel(live),
      pricing_type: 'fixed' as const,
      unit: inventoryUnit(live.price_type),
      image: live.image || fallback?.image || '',
      available: live.available,
      bookable: live.available,
    })
  }

  const data = baseItems.map((item) => {
    if (item.id === 'camping-ground') {
      const smallPrice = settings['camping.small_tent_price']
      const largePrice = settings['camping.large_tent_price']
      if (smallPrice === null || smallPrice === undefined || largePrice === null || largePrice === undefined) {
        return {
          ...item,
          price: 0,
          max_price: null,
          price_label: 'Harga belum tersedia',
          pricing_type: 'contact' as const,
          bookable: false,
        }
      }
      return {
        ...item,
        price: smallPrice,
        max_price: largePrice,
        price_label: `${formatRupiah(smallPrice)}–${formatRupiah(largePrice)}`,
        pricing_type: 'range' as const,
      }
    }
    const glampingPrice = settings['camping.glamping_base_price']
    if (item.id !== 'glamping') return item
    if (glampingPrice === null || glampingPrice === undefined) {
      return {
        ...item,
        price: 0,
        max_price: null,
        price_label: 'Harga belum tersedia',
        pricing_type: 'contact' as const,
        bookable: false,
      }
    }
    return {
      ...item,
      price: glampingPrice,
      max_price: null,
      price_label: formatRupiah(glampingPrice),
      pricing_type: 'fixed' as const,
      unit: 'malam',
      bookable: item.available,
    }
  })

  return {
    data,
    source: catalog.source === 'database'
      ? (liveVenues.length ? 'database+inventory' : 'database')
      : (liveVenues.length ? 'fallback+inventory' : 'fallback'),
  }
}
