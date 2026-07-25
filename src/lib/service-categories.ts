export interface ServiceCategory {
  id: string
  name: string
  image: string
  description: string
  position?: string
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: 'semua',
    name: 'Semua',
    image: '/images/village-hero.jpg',
    description: 'Jelajahi seluruh layanan dan pengalaman yang tersedia di Arenan Kalikesek.',
    position: 'center',
  },
  {
    id: 'tiket',
    name: 'Tiket',
    image: '/images/booking-tiket.png',
    description: 'Tiket masuk, kolam renang, dan pilihan wahana untuk menikmati kawasan wisata.',
    position: 'center 58%',
  },
  {
    id: 'aktivitas',
    name: 'Aktivitas',
    image: '/images/wisata-berkuda.jpg',
    description: 'Aktivitas alam dan edukasi yang dapat dinikmati bersama keluarga atau rombongan.',
    position: 'center',
  },
  {
    id: 'gratis',
    name: 'Gratis',
    image: '/images/booking-gratis.jpg',
    description: 'Pilihan pengalaman alam tanpa biaya tambahan di sekitar kawasan Kalikesek.',
    position: 'center',
  },
  {
    id: 'sewa-tempat',
    name: 'Sewa Tempat',
    image: '/images/booking-sewa-tempat.jpg',
    description: 'Pendopo, gazebo, dan aula untuk pertemuan, kegiatan komunitas, atau acara keluarga.',
    position: 'center 55%',
  },
  {
    id: 'paket-edukasi',
    name: 'Paket Edukasi',
    image: '/images/booking-paket-edukasi.jpg',
    description: 'Paket kunjungan terarah untuk sekolah, komunitas, dan kegiatan belajar bersama warga.',
    position: 'center',
  },
  {
    id: 'homestay',
    name: 'Homestay',
    image: '/images/booking-homestay.jpg',
    description: 'Pilihan menginap yang dekat dengan alam dan suasana kehidupan desa Kalikesek.',
    position: 'center 58%',
  },
  {
    id: 'camping',
    name: 'Camping',
    image: '/images/booking-camping.png',
    description: 'Area berkemah dengan suasana pegunungan dan lanskap hijau Arenan Kalikesek.',
    position: 'center',
  },
  {
    id: 'fishing',
    name: 'Fishing',
    image: '/images/booking-fishing.jpg',
    description: 'Kegiatan memancing dan pengalaman santai di lingkungan sungai yang alami.',
    position: 'center',
  },
]

export function getServiceCategory(id: string) {
  return serviceCategories.find((category) => category.id === id) || serviceCategories[0]
}
