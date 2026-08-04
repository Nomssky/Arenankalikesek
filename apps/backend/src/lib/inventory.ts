import { formatRupiah } from '@repo/shared-utils'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase-server'

export interface InventoryRecord {
  id: string
  name: string
  category: string
  price: number
  price_type: 'per_jam' | 'per_hari' | 'per_malam' | 'flat'
  image: string | null
  available: boolean
}

export const RENTAL_VENUE_CATEGORIES = ['area-kegiatan', 'tempat-pertemuan']

export function inventoryUnit(priceType: InventoryRecord['price_type']): string | null {
  if (priceType === 'per_jam') return 'jam'
  if (priceType === 'per_hari') return 'hari'
  if (priceType === 'per_malam') return 'malam'
  return null
}

export function inventoryPriceLabel(record: Pick<InventoryRecord, 'price' | 'price_type'>) {
  const unit = inventoryUnit(record.price_type)
  return unit ? `${formatRupiah(record.price)} per ${unit}` : formatRupiah(record.price)
}

export async function loadInventory(): Promise<InventoryRecord[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await getSupabaseAdmin()
    .from('inventory_rentals')
    .select('id,name,category,price_per_unit,price_type,image,available')
  if (error) {
    console.error('Inventory load error:', error)
    return []
  }
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price_per_unit ?? 0,
    price_type: row.price_type,
    image: row.image,
    available: row.available ?? true,
  }))
}

export async function inventoryVenues(): Promise<InventoryRecord[]> {
  const records = await loadInventory()
  return records.filter((record) => RENTAL_VENUE_CATEGORIES.includes(record.category))
}

export async function inventoryVenuePrice(itemId: string): Promise<number | null> {
  const venues = await inventoryVenues()
  const match = venues.find((record) => record.id === itemId)
  return match ? match.price : null
}
