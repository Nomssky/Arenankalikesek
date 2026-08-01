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
    id: 'aktivitas',
    name: 'Wahana & Aktivitas',
    image: '/images/wisata-berkuda.jpg',
    description: 'Wahana keluarga dan aktivitas alam yang tersedia di kawasan Arenan Kalikesek.',
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
    id: 'fishing',
    name: 'Kolam Pancing',
    image: '/images/booking-fishing.jpg',
    description: 'Kolam pancing, penyewaan alat, dan kebutuhan memancing di lingkungan yang alami.',
    position: 'center',
  },
  {
    id: 'paket-edukasi',
    name: 'Kalikesek Edu Trip',
    image: '/images/booking-paket-edukasi.jpg',
    description: 'Paket edukasi untuk rombongan minimal 25 anak dengan kegiatan alam yang terarah.',
    position: 'center',
  },
  {
    id: 'paket-kegiatan',
    name: 'Paket Kegiatan',
    image: '/images/wisata-jelajah.jpg',
    description: 'Paket kegiatan lengkap dengan pengalaman wisata, makan siang, dan welcome drink.',
    position: 'center',
  },
  {
    id: 'area-kegiatan',
    name: 'Area Kegiatan',
    image: '/images/booking-camping.png',
    description: 'Area outbound, senam, dan camping ground untuk kegiatan keluarga atau komunitas.',
    position: 'center',
  },
  {
    id: 'tempat-pertemuan',
    name: 'Tempat Pertemuan',
    image: '/images/booking-sewa-tempat.jpg',
    description: 'Joglo, pawon, gazebo, panggung, dan aula untuk pertemuan atau acara.',
    position: 'center 55%',
  },
  {
    id: 'homestay',
    name: 'Homestay',
    image: '/images/booking-homestay.jpg',
    description: 'Homestay keluarga dengan Wi-Fi gratis dan pilihan harga weekday hingga holiday.',
    position: 'center 58%',
  },
  {
    id: 'camping',
    name: 'Camping Ground',
    image: '/images/booking-camping.png',
    description: 'Area camping dengan pilihan tenda kecil atau besar per malam.',
    position: 'center',
  },
  {
    id: 'glamping',
    name: 'Glamping',
    image: '/images/booking-camping.png',
    description: 'Pilihan menginap bernuansa alam dengan fasilitas glamping.',
    position: 'center',
  },
]

export function getServiceCategory(id: string) {
  return serviceCategories.find((category) => category.id === id) || serviceCategories[0]
}
