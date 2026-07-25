export interface SiteContent {
  title: string
  content: string
  slug: string
  image?: string
  meta?: Record<string, string>
}

export interface BlogPost {
  slug: string
  title: string
  date: string
  author?: string
  category?: string
  excerpt: string
  content: string
  image?: string
  published: boolean
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image?: string
  category: string
  stock: number
}

export interface TourPackage {
  id: string
  name: string
  description: string
  price: number
  priceType: 'per_person' | 'flat' | 'range'
  maxPrice?: number
  image?: string
  category: 'aktivitas' | 'ruangan' | 'homestay' | 'camping' | 'fishing' | 'gratis'
  available: boolean
}

export interface ParkingType {
  code: string
  name: string
  pricePerHour: number
  pricePerDay?: number
  available: boolean
}

export interface Booking {
  id: string
  type: 'wisata' | 'toko' | 'sewa'
  customerName: string
  customerPhone: string
  customerEmail?: string
  items: BookingItem[]
  totalAmount: number
  status: 'pending' | 'paid' | 'confirmed' | 'cancelled'
  paymentMethod?: string
  paymentUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface BookingItem {
  itemId: string
  itemName: string
  quantity: number
  price: number
  date?: string
  timeStart?: string
  timeEnd?: string
}

export interface MidtransTransaction {
  transactionId: string
  bookingId: string
  grossAmount: number
  status: string
  paymentUrl?: string
}
