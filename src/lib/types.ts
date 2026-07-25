export type BookingStatus = 'pending' | 'paid' | 'confirmed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type BookingType = 'wisata' | 'toko' | 'parkir' | 'sewa'

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

export interface BookingRow {
  id: string
  type: BookingType
  booking_code: string | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_address: string | null
  event_name: string | null
  booking_date: string | null
  time_start: string | null
  time_end: string | null
  items: BookingItem[]
  total_amount: number
  status: BookingStatus
  payment_status: PaymentStatus
  payment_method: string | null
  payment_url: string | null
  assigned_pic: string | null
  notes: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface BookingItem {
  id: string
  name: string
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
