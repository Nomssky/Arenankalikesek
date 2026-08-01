import {
  getProductPriceLabel,
  getTourPriceLabel,
  storeProducts,
  tourServices,
  type PricingRate,
  type PricingType,
} from '@/data/pricing'

export interface FallbackTourPackage {
  id: string
  name: string
  category: string
  price: number
  max_price: number | null
  price_label: string
  pricing_type: PricingType
  unit: string | null
  capacity: string | null
  note: string | null
  facilities: string[]
  rate_options: PricingRate[]
  image: string
  available: boolean
  bookable: boolean
  sort_order: number
}

export interface FallbackProduct {
  id: string
  name: string
  price: number
  price_label: string
  category: string
  image: string
  description: string
  unit: string
  available: boolean
  purchasable: boolean
  sort_order: number
}

export interface FallbackInventoryItem {
  id: string
  name: string
  description: string
  category: string
  price_per_unit: number
  price_type: 'per_jam' | 'per_hari' | 'per_malam' | 'flat'
  price_label: string
  capacity: string | null
  stock: number
  image: string
  available: boolean
}

export const fallbackTourPackages: FallbackTourPackage[] = tourServices.map(
  (service, index) => ({
    id: service.id,
    name: service.name,
    category: service.category,
    price: service.price || 0,
    max_price: service.maxPrice || null,
    price_label: getTourPriceLabel(service),
    pricing_type: service.priceType,
    unit: service.unit || null,
    capacity: service.capacity || null,
    note: service.note || null,
    facilities: service.facilities || [],
    rate_options: service.rates || [],
    image: service.image,
    available: true,
    bookable: service.bookable,
    sort_order: index + 1,
  })
)

export const fallbackProducts: FallbackProduct[] = storeProducts.map(
  (product, index) => ({
    id: product.id,
    name: product.name,
    price: product.price || 0,
    price_label: getProductPriceLabel(product),
    category: product.category,
    image: product.image,
    description: product.description,
    unit: product.unit,
    available: true,
    purchasable: product.purchasable,
    sort_order: index + 1,
  })
)

const inventoryCategoryIds = new Set([
  'fishing',
  'area-kegiatan',
  'tempat-pertemuan',
  'homestay',
  'camping',
  'glamping',
])

export const fallbackInventoryItems: FallbackInventoryItem[] = tourServices
  .filter((service) => inventoryCategoryIds.has(service.category))
  .map((service) => ({
    id: service.id,
    name: service.name,
    description: service.note || service.capacity || '',
    category: service.category,
    price_per_unit: service.price || 0,
    price_type:
      service.unit === 'jam'
        ? 'per_jam'
        : ['homestay', 'camping', 'glamping'].includes(service.category)
          ? 'per_malam'
          : 'flat',
    price_label: getTourPriceLabel(service),
    capacity: service.capacity || null,
    stock: 1,
    image: service.image,
    available: true,
  }))
