import Link from 'next/link'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

export default function EduwisataPage() {
  return (
    <>
      <Hero
        title="Eduwisata Gula Aren"
        subtitle="Belajar dan merasakan langsung proses pembuatan gula aren tradisional"
        image="/images/wisata-jelajah.jpg"
        height="md"
      />

      <Section>
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-lg max-w-none mb-12">
            <p>
              Nikmati pengalaman edukatif yang unik di Arenan Kalikesek! Anda akan diajak
              untuk melihat dan merasakan langsung proses pembuatan gula aren, mulai dari
              penyadapan nira hingga pengolahan menjadi gula aren yang manis dan alami.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              {
                step: '1',
                title: 'Penyadapan Nira',
                desc: 'Menyadap nira dari pohon aren langsung oleh petani berpengalaman',
              },
              {
                step: '2',
                title: 'Proses Memasak',
                desc: 'Memasak nira hingga mengental dan berubah warna menjadi coklat keemasan',
              },
              {
                step: '3',
                title: 'Pencetakan',
                desc: 'Mencetak gula aren dalam cetakan bambu tradisional',
              },
            ].map((item) => (
              <div key={item.step} className="card p-6 text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl p-8 md:p-12 text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Tertarik dengan Paket Eduwisata?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Pesan paket wisata gula aren untuk mendapatkan edukasi pembuatan gula aren
              secara langsung. Cocok untuk study tour keluarga, sekolah, maupun komunitas.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/booking/wisata" className="btn-primary">
                Pesan Sekarang
              </Link>
              <a
                href="https://wa.me/6285741171957"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Tanya via WhatsApp
              </a>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
