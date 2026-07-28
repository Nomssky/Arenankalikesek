export type ServiceCategoryId =
  | 'gratis'
  | 'aktivitas'
  | 'fishing'
  | 'paket-edukasi'
  | 'paket-kegiatan'
  | 'area-kegiatan'
  | 'tempat-pertemuan'
  | 'homestay'

export type PricingType =
  | 'fixed'
  | 'range'
  | 'free'
  | 'contact'
  | 'market'
  | 'rates'

export interface PricingRate {
  label: 'Weekday' | 'Weekend' | 'Holiday'
  price: number
}

export interface TourService {
  id: string
  name: string
  category: ServiceCategoryId
  priceType: PricingType
  price: number | null
  maxPrice?: number | null
  unit?: string | null
  capacity?: string | null
  note?: string | null
  facilities?: string[]
  rates?: PricingRate[]
  image: string
  imagePosition?: string
  bookable: boolean
}

export interface StoreProductPricing {
  id: string
  name: string
  category: 'paket-makanan'
  priceType: 'fixed' | 'contact'
  price: number | null
  unit: string
  description: string
  image: string
  purchasable: boolean
}

const eduTripMinimum = 'Harga berlaku untuk minimal 25 anak.'
const homestayTerms =
  'Wi-Fi gratis. Check-in pukul 14.00 dan check-out pukul 12.00.'

export const tourServices: TourService[] = [
  {
    id: 'terapi-ikan',
    name: 'Terapi Ikan',
    category: 'gratis',
    priceType: 'free',
    price: 0,
    image: '/images/wisata-sungai.jpg',
    bookable: true,
  },
  {
    id: 'keceh-kali',
    name: 'Keceh Kali',
    category: 'gratis',
    priceType: 'free',
    price: 0,
    image: '/images/wisata-keceh-air.jpg',
    bookable: true,
  },
  {
    id: 'berkuda',
    name: 'Berkuda',
    category: 'aktivitas',
    priceType: 'range',
    price: 15000,
    maxPrice: 20000,
    image: '/images/wisata-berkuda.jpg',
    bookable: true,
  },
  {
    id: 'kolam-renang',
    name: 'Kolam Renang',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 5000,
    image: '/images/booking-tiket.png',
    bookable: true,
  },
  {
    id: 'atv-anak',
    name: 'ATV Anak',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 5000,
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'kereta-sawah',
    name: 'Kereta Sawah',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 15000,
    note: '2 putaran',
    image: '/images/village-panen.jpg',
    bookable: true,
  },
  {
    id: 'rainbow-slide',
    name: 'Rainbow Slide',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 10000,
    note: '1 kali meluncur',
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'wahana-permainan-anak',
    name: 'Wahana Permainan Anak',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 10000,
    unit: 'wahana',
    image: '/images/booking-tiket.png',
    bookable: true,
  },
  {
    id: 'taman-kelinci',
    name: 'Taman Kelinci',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 10000,
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'kolam-pancing',
    name: 'Kolam Pancing',
    category: 'fishing',
    priceType: 'market',
    price: null,
    note: 'Sesuai harga ikan per kilogram',
    image: '/images/booking-fishing.jpg',
    bookable: false,
  },
  {
    id: 'sewa-alat-pancing',
    name: 'Sewa Alat Pancing',
    category: 'fishing',
    priceType: 'fixed',
    price: 5000,
    image: '/images/wisata-sungai.jpg',
    bookable: true,
  },
  {
    id: 'pelet-umpan',
    name: 'Pelet Umpan',
    category: 'fishing',
    priceType: 'fixed',
    price: 5000,
    image: '/images/wisata-keceh-air.jpg',
    bookable: true,
  },
  {
    id: 'jeep',
    name: 'Jeep',
    category: 'aktivitas',
    priceType: 'fixed',
    price: 120000,
    unit: '4 orang dewasa',
    capacity: '4 orang dewasa',
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'edu-trip-kesek-1',
    name: 'Edu Trip Kesek 1',
    category: 'paket-edukasi',
    priceType: 'fixed',
    price: 35000,
    unit: 'orang',
    note: eduTripMinimum,
    facilities: ['HTM', 'Keceh kali', 'Terapi ikan', 'Menanam padi', 'Berenang'],
    image: '/images/booking-paket-edukasi.jpg',
    bookable: true,
  },
  {
    id: 'edu-trip-kesek-2',
    name: 'Edu Trip Kesek 2',
    category: 'paket-edukasi',
    priceType: 'fixed',
    price: 35000,
    unit: 'orang',
    note: eduTripMinimum,
    facilities: ['HTM', 'Keceh kali', 'Terapi ikan', 'Tangkap ikan', 'Berenang'],
    image: '/images/booking-paket-edukasi.jpg',
    bookable: true,
  },
  {
    id: 'edu-trip-kesek-3',
    name: 'Edu Trip Kesek 3',
    category: 'paket-edukasi',
    priceType: 'fixed',
    price: 50000,
    unit: 'orang',
    note: eduTripMinimum,
    facilities: [
      'HTM',
      'Keceh kali',
      'Terapi ikan',
      'Menanam padi',
      'Tangkap ikan',
      'Berenang',
    ],
    image: '/images/booking-paket-edukasi.jpg',
    bookable: true,
  },
  {
    id: 'edu-trip-kesek-4',
    name: 'Edu Trip Kesek 4',
    category: 'paket-edukasi',
    priceType: 'fixed',
    price: 50000,
    unit: 'orang',
    note: eduTripMinimum,
    facilities: [
      'HTM',
      'Keceh kali',
      'Terapi ikan',
      'Cooking class',
      'Tangkap ikan',
      'Berenang',
    ],
    image: '/images/booking-paket-edukasi.jpg',
    bookable: true,
  },
  {
    id: 'edu-trip-kesek-5',
    name: 'Edu Trip Kesek 5',
    category: 'paket-edukasi',
    priceType: 'fixed',
    price: 80000,
    unit: 'orang',
    note: eduTripMinimum,
    facilities: [
      'HTM',
      'Keceh kali',
      'Terapi ikan',
      'Fun game durasi 2 jam',
      'Tangkap ikan',
      'Berenang',
    ],
    image: '/images/booking-paket-edukasi.jpg',
    bookable: true,
  },
  {
    id: 'package-1',
    name: 'Package 1',
    category: 'paket-kegiatan',
    priceType: 'fixed',
    price: 90000,
    unit: 'orang',
    facilities: [
      'HTM',
      'Keceh kali',
      'Terapi ikan',
      'Edukasi pembuatan gula aren',
      'Lunch',
      'Welcome drink',
    ],
    image: '/images/wisata-jelajah.jpg',
    bookable: true,
  },
  {
    id: 'package-2',
    name: 'Package 2',
    category: 'paket-kegiatan',
    priceType: 'fixed',
    price: 100000,
    unit: 'orang',
    facilities: [
      'HTM',
      'Keceh kali',
      'Terapi ikan',
      'Fun game',
      'Welcome drink',
      'Lunch',
    ],
    image: '/images/wisata-jelajah.jpg',
    bookable: true,
  },
  {
    id: 'package-3',
    name: 'Package 3',
    category: 'paket-kegiatan',
    priceType: 'fixed',
    price: 120000,
    unit: 'orang',
    facilities: [
      'HTM',
      'Keceh kali',
      'Terapi ikan',
      'Edukasi pembuatan gula aren',
      'Fun game',
      'Lunch',
      'Welcome drink',
    ],
    image: '/images/wisata-jelajah.jpg',
    bookable: true,
  },
  {
    id: 'area-outbound',
    name: 'Area Outbound',
    category: 'area-kegiatan',
    priceType: 'fixed',
    price: 25000,
    unit: 'jam',
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'area-senam',
    name: 'Area Senam',
    category: 'area-kegiatan',
    priceType: 'fixed',
    price: 25000,
    unit: 'acara',
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'camping-ground',
    name: 'Camping Ground',
    category: 'area-kegiatan',
    priceType: 'contact',
    price: null,
    image: '/images/booking-camping.png',
    bookable: false,
  },
  {
    id: 'joglo',
    name: 'Joglo',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 100000,
    unit: 'jam',
    capacity: '40–50 orang',
    image: '/images/booking-sewa-tempat.jpg',
    bookable: true,
  },
  {
    id: 'pawon',
    name: 'Pawon',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 50000,
    unit: 'jam',
    capacity: '30–40 orang',
    image: '/images/village-tradition.jpg',
    bookable: true,
  },
  {
    id: 'gazebo-atas',
    name: 'Gazebo Atas',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 30000,
    unit: 'jam',
    capacity: '20–25 orang',
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'panggung',
    name: 'Panggung',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 75000,
    unit: 'jam',
    capacity: '40–50 orang',
    image: '/images/booking-sewa-tempat.jpg',
    bookable: true,
  },
  {
    id: 'gazebo-bawah',
    name: 'Gazebo Bawah',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 50000,
    unit: 'jam',
    capacity: '20–25 orang',
    image: '/images/village-landscape.jpg',
    bookable: true,
  },
  {
    id: 'aula-dalam',
    name: 'Aula Dalam',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 75000,
    unit: 'jam',
    capacity: '35–40 orang',
    image: '/images/booking-sewa-tempat.jpg',
    bookable: true,
  },
  {
    id: 'aula-teras',
    name: 'Aula Teras',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 75000,
    unit: 'jam',
    capacity: '35–40 orang',
    image: '/images/booking-sewa-tempat.jpg',
    bookable: true,
  },
  {
    id: 'aula-full',
    name: 'Aula Full',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 150000,
    unit: 'jam',
    capacity: '60–80 orang',
    image: '/images/booking-sewa-tempat.jpg',
    bookable: true,
  },
  {
    id: 'aula-sungai',
    name: 'Aula Sungai',
    category: 'tempat-pertemuan',
    priceType: 'fixed',
    price: 100000,
    unit: 'jam',
    capacity: '70–90 orang',
    image: '/images/wisata-sungai.jpg',
    bookable: true,
  },
  {
    id: 'aren-1',
    name: 'Aren 1',
    category: 'homestay',
    priceType: 'rates',
    price: 200000,
    maxPrice: 300000,
    capacity: '2–5 orang',
    note: homestayTerms,
    rates: [
      { label: 'Weekday', price: 200000 },
      { label: 'Weekend', price: 250000 },
      { label: 'Holiday', price: 300000 },
    ],
    facilities: [
      'Kamar mandi dalam',
      '1 tempat tidur',
      'Kipas angin',
      'Teko listrik',
      'Kopi dan teh',
      'Air mineral 2 botol',
      'Wi-Fi gratis',
    ],
    image: '/images/booking-homestay.jpg',
    bookable: true,
  },
  {
    id: 'aren-2',
    name: 'Aren 2',
    category: 'homestay',
    priceType: 'rates',
    price: 200000,
    maxPrice: 300000,
    capacity: '2–5 orang',
    note: homestayTerms,
    rates: [
      { label: 'Weekday', price: 200000 },
      { label: 'Weekend', price: 250000 },
      { label: 'Holiday', price: 300000 },
    ],
    facilities: [
      'Kamar mandi dalam',
      '1 tempat tidur',
      'Kipas angin',
      'Teko listrik',
      'Kopi dan teh',
      'Air mineral 2 botol',
      'Wi-Fi gratis',
    ],
    image: '/images/booking-homestay.jpg',
    bookable: true,
  },
  {
    id: 'aren-3',
    name: 'Aren 3',
    category: 'homestay',
    priceType: 'rates',
    price: 375000,
    maxPrice: 500000,
    capacity: '6–8 orang',
    note: homestayTerms,
    rates: [
      { label: 'Weekday', price: 375000 },
      { label: 'Weekend', price: 450000 },
      { label: 'Holiday', price: 500000 },
    ],
    facilities: [
      'Kamar mandi dalam',
      '2 tempat tidur',
      'Ruangan luas',
      'Kipas angin',
      'Smart TV',
      'Teko listrik',
      'Kopi dan teh',
      'Air mineral 4 botol',
      'Wi-Fi gratis',
    ],
    image: '/images/booking-homestay.jpg',
    bookable: true,
  },
  {
    id: 'aren-4',
    name: 'Aren 4',
    category: 'homestay',
    priceType: 'rates',
    price: 450000,
    maxPrice: 575000,
    capacity: '8–10 orang',
    note: homestayTerms,
    rates: [
      { label: 'Weekday', price: 450000 },
      { label: 'Weekend', price: 500000 },
      { label: 'Holiday', price: 575000 },
    ],
    facilities: [
      'Kamar mandi dalam',
      'Dapur',
      '2 kamar',
      'Ruang keluarga',
      'Kipas angin',
      'Smart TV',
      'Teko listrik',
      'Kopi dan teh',
      'Air mineral 4 botol',
      'Wi-Fi gratis',
    ],
    image: '/images/booking-homestay.jpg',
    bookable: true,
  },
  {
    id: 'extra-bed',
    name: 'Extra Bed 100 × 220 cm',
    category: 'homestay',
    priceType: 'fixed',
    price: 25000,
    unit: 'unit',
    image: '/images/booking-homestay.jpg',
    bookable: true,
  },
  {
    id: 'tambahan-tamu',
    name: 'Tambahan Tamu',
    category: 'homestay',
    priceType: 'fixed',
    price: 10000,
    unit: 'orang',
    note: 'Untuk tamu yang melebihi kapasitas homestay.',
    image: '/images/booking-homestay.jpg',
    bookable: true,
  },
]

export const storeProducts: StoreProductPricing[] = [
  ['paket-menu-1', 'Paket 1', 8000, true],
  ['paket-menu-2', 'Paket 2', 9000, true],
  ['paket-menu-3', 'Paket 3', 12000, true],
  ['paket-menu-4', 'Paket 4', 15000, true],
  ['paket-menu-5', 'Paket 5', 15000, true],
  ['paket-menu-6', 'Paket 6', 17000, true],
  ['paket-menu-7', 'Paket 7', 22000, true],
  ['paket-menu-8', 'Paket 8', 25000, true],
  ['paket-menu-9', 'Paket 9', 25000, true],
  ['paket-menu-10', 'Paket 10', null, false],
].map(([id, name, price, purchasable]) => ({
  id: id as string,
  name: name as string,
  category: 'paket-makanan' as const,
  priceType: purchasable ? ('fixed' as const) : ('contact' as const),
  price: price as number | null,
  unit: 'paket',
  description: 'Paket menu makanan Arenan Kalikesek',
  image:
    '/images/paket-makan.jpg',
  purchasable: purchasable as boolean,
}))

export function formatRupiah(amount: number) {
  return `Rp${amount.toLocaleString('id-ID')}`
}

export function getTourPriceLabel(service: TourService) {
  if (service.priceType === 'free') return 'Gratis'
  if (service.priceType === 'contact') return 'Hubungi pengelola'
  if (service.priceType === 'market') return 'Sesuai harga ikan per kilogram'
  if (service.priceType === 'range' || service.priceType === 'rates') {
    return `${formatRupiah(service.price || 0)}–${formatRupiah(service.maxPrice || service.price || 0)}`
  }
  return service.price === null ? 'Hubungi pengelola' : formatRupiah(service.price)
}

export function getProductPriceLabel(product: StoreProductPricing) {
  return product.price === null ? 'Hubungi pengelola' : formatRupiah(product.price)
}

export function getTourService(id: string) {
  return tourServices.find((service) => service.id === id)
}
