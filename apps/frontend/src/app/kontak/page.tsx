import Hero from '@/components/Hero'
import Section from '@/components/Section'

export default function KontakPage() {
  return (
    <>
      <Hero title="Kontak Kami" subtitle="Hubungi kami untuk informasi dan reservasi" image="/images/village-sign.jpg" height="full" />

      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="card p-5 sm:p-8">
            <h3 className="text-xl font-semibold mb-6">Informasi Kontak</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">Alamat</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Kalikesek, Sriwulan, Kec. Limbangan
                    <br />
                    Kabupaten Kendal, Jawa Tengah, 51383
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">WhatsApp</p>
                  <a
                    href="https://wa.me/6285741171957"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 text-sm mt-1 inline-block"
                  >
                    +62 857-4117-1957
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">Email</p>
                  <a
                    href="mailto:arenankalikesek@gmail.com"
                    className="break-anywhere mt-1 inline-block text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    arenankalikesek@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3963.0!2d110.0!3d-7.0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zN8KwMDAnMDAuMCJTIDExMMKwMDAnMDAuMCJF!5e0!3m2!1sid!2sid!4v1"
              width="100%"
              height="100%"
              className="min-h-[320px] sm:min-h-[400px]"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Lokasi Arenan Kalikesek"
            />
          </div>
        </div>
      </Section>

      <Section
        id="bagian-sosmed"
        title="Media Sosial"
        subtitle="Ikuti kami di media sosial"
        className="bg-gray-50"
      >
        <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 sm:mx-auto sm:max-w-xl sm:gap-6">
          <a
            href="https://www.instagram.com/arenankalikesek/"
            target="_blank"
            rel="noopener noreferrer"
            className="card p-6 text-center transition-transform hover:-translate-y-1 sm:p-8"
          >
            <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Instagram</p>
            <p className="text-sm text-gray-500 mt-1">@arenankalikesek</p>
          </a>

          <a
            href="https://www.tiktok.com/@arenankalikesek"
            target="_blank"
            rel="noopener noreferrer"
            className="card p-6 text-center transition-transform hover:-translate-y-1 sm:p-8"
          >
            <div className="w-16 h-16 mx-auto mb-3 bg-gray-900 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">TikTok</p>
            <p className="text-sm text-gray-500 mt-1">@arenankalikesek</p>
          </a>
        </div>
      </Section>
    </>
  )
}
