import type { Metadata, Viewport } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Arenan Kalikesek | Desa Wisata Sriwulan',
  description:
    'Desa Wisata Arenan Kalikesek Sriwulan, Kecamatan Limbangan, Kabupaten Kendal, Jawa Tengah. Nikmati keindahan alam dan berbagai aktivitas wisata menarik.',
  keywords: ['wisata', 'kalikesek', 'sriwulan', 'kendal', 'desa wisata', 'arenan'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
