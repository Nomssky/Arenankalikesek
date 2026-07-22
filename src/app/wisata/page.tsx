import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

export default function WisataPage() {
  return (
    <>
      <Hero
        title="Wisata Kalikesek"
        subtitle="Temukan berbagai pilihan aktivitas wisata seru"
        height="sm"
      />

      <Section title="🎫 Tiket & Wahana" subtitle="Tiket masuk dan wahana permainan">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'HTM (Tiket Masuk)', price: 'Rp5.000' },
            { name: 'Kolam Anak', price: 'Rp5.000' },
            { name: 'Berenang', price: 'Rp5.000' },
            { name: 'Wahana Permainan Anak', price: 'Rp10.000/wahana' },
            { name: 'Tangkap Ikan', price: 'Rp10.000' },
            { name: 'Terapi Ikan', price: 'Gratis' },
            { name: 'Keceh Kali (Bermain Sungai)', price: 'Gratis' },
          ].map((item) => (
            <div key={item.name} className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-emerald-600 font-medium">{item.price}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🎯 Aktivitas Wisata" subtitle="Berbagai aktivitas seru" className="bg-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Tanam Padi', price: 'Rp15.000' },
            { name: 'Tanam Sayur', price: 'Rp10.000' },
            { name: 'Cooking Class', price: 'Rp25.000' },
            { name: 'Fun Game (2 jam)', price: 'Rp15.000' },
            { name: 'Edukasi Pembuatan Gula Aren', price: 'Rp20.000' },
          ].map((item) => (
            <div key={item.name} className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-emerald-600 font-medium">{item.price}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🎒 Paket Edukasi & Edu Trip" subtitle="Paket lengkap untuk studi wisata">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Edu Trip Kesek 1', price: 'Rp35.000/pax' },
            { name: 'Edu Trip Kesek 2', price: 'Rp35.000/pax' },
            { name: 'Edu Trip Kesek 3', price: 'Rp50.000/pax' },
            { name: 'Edu Trip Kesek 4', price: 'Rp50.000/pax' },
            { name: 'Edu Trip Kesek 5', price: 'Rp80.000/pax' },
          ].map((item) => (
            <div key={item.name} className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-emerald-600 font-medium">{item.price}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Package Edukasi</h3>
          {[
            { name: 'Package Edukasi 1', price: 'Rp90.000/pax', desc: 'HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Lunch + Welcome drink' },
            { name: 'Package Edukasi 2', price: 'Rp100.000/pax', desc: 'HTM + Keceh Kali + Terapi Ikan + Fun Game + Lunch + Welcome drink' },
            { name: 'Package Edukasi 3', price: 'Rp120.000/pax', desc: 'HTM + Keceh Kali + Terapi Ikan + Edukasi Gula Aren + Fun Game + Lunch + Welcome drink' },
          ].map((item) => (
            <div key={item.name} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                </div>
                <p className="text-emerald-600 font-bold whitespace-nowrap">{item.price}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🏠 Sewa Tempat & Aula" subtitle="Berbagai pilihan ruangan untuk acara Anda" className="bg-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            { name: 'Pendopo', capacity: '90-100 org', price: 'Rp100.000/jam' },
            { name: 'Pendopo Besar', capacity: '40-50 org', price: 'Rp75.000/jam' },
            { name: 'Gazebo', capacity: '30-40 org', price: 'Rp50.000/jam' },
            { name: 'Gazebo Bawah', capacity: '20-25 org', price: 'Rp30.000/jam' },
            { name: 'Aula Dalam', capacity: '35-40 org', price: 'Rp75.000/jam' },
            { name: 'Aula Teras', capacity: '35-40 org', price: 'Rp75.000/jam' },
            { name: 'Aula Full', capacity: '60-80 org', price: 'Rp200.000/jam' },
            { name: 'Aula Sungai', capacity: '70-90 org', price: 'Rp100.000/jam' },
            { name: 'Outbound', price: 'Rp25.000/jam' },
            { name: 'Senam', price: 'Rp25.000/acara' },
          ].map((item) => (
            <div key={item.name} className="card p-5 text-center">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              {item.capacity && <p className="text-xs text-gray-500 mb-1">Kap. {item.capacity}</p>}
              <p className="text-emerald-600 font-medium">{item.price}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🏕️ Camping" subtitle="Berkemah di alam terbuka">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'HTM Camp', price: 'Rp5.000/orang' },
            { name: 'Spot Tenda', price: 'Rp25.000' },
            { name: 'Spot Tenda Besar', price: 'Rp40.000' },
            { name: 'Tenda 4 Orang', price: 'Rp75.000' },
          ].map((item) => (
            <div key={item.name} className="card p-5 text-center">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-emerald-600 font-medium">{item.price}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="🏡 Homestay" subtitle="Menginap nyaman dengan pemandangan alam" className="bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              name: 'Aren 1 & 2',
              capacity: '2-5 orang',
              price: 'Rp200rb - Rp300rb/malam',
              facilities: 'Kamar mandi dalam, 1 bed, kipas angin, teko listrik, kopi & teh, air mineral 2 botol',
            },
            {
              name: 'Aren 3',
              capacity: '6-8 orang',
              price: 'Rp375rb - Rp500rb/malam',
              facilities: 'Kamar mandi dalam, 2 bed, space luas, kipas angin, Smart TV, teko listrik, kopi & teh, air mineral 4 botol',
            },
            {
              name: 'Aren 4',
              capacity: '8-10 orang',
              price: 'Rp450rb - Rp575rb/malam',
              facilities: 'Kamar mandi dalam, dapur, 2 kamar, ruang keluarga, kipas angin, Smart TV, teko listrik, kopi & teh, air mineral 4 botol',
            },
          ].map((item) => (
            <div key={item.name} className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-sm text-gray-500 mb-2">{item.capacity}</p>
              <p className="text-emerald-600 font-bold mb-2">{item.price}</p>
              <p className="text-sm text-gray-600">{item.facilities}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-amber-50 rounded-xl text-sm text-gray-700">
          <p className="font-medium">Informasi Penginapan:</p>
          <p>Check-in: 14.00 | Check-out: 12.00</p>
          <p>Extra bed (100x220): Rp25.000 | Over kapasitas: Rp10.000/orang</p>
          <p className="mt-1 text-xs text-gray-500">Harga: Weekday / Weekend / Holiday</p>
        </div>
      </Section>

      <Section title="🎣 Fishing & Kolam" subtitle="Mancing asyik di Kalikesek">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { name: 'Sewa Alat Pancing', price: 'Rp5.000' },
            { name: 'Pelet Umpan', price: 'Rp5.000' },
            { name: 'Ikan Nila', price: 'Rp38.000/kg' },
            { name: 'Ikan Bawal', price: 'Rp32.000/kg' },
            { name: 'Ikan Kalper', price: 'Rp38.000/kg' },
          ].map((item) => (
            <div key={item.name} className="card p-5 text-center">
              <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
              <p className="text-emerald-600 font-medium">{item.price}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <Link href="/booking/wisata" className="btn-primary text-lg">
            Booking Sekarang
          </Link>
        </div>
      </Section>
    </>
  )
}
