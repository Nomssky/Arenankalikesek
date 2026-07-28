import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'lenis/dist/lenis.css'
import SiteFrame from '@/components/SiteFrame'

export const metadata: Metadata = {
  title: {
    default: 'Arenan Kalikesek | Desa Wisata Sriwulan',
    template: '%s | Arenan Kalikesek',
  },
  description:
    'Desa Wisata Arenan Kalikesek Sriwulan, Kecamatan Limbangan, Kabupaten Kendal, Jawa Tengah. Nikmati keindahan alam dan berbagai aktivitas wisata menarik.',
  keywords: ['wisata', 'kalikesek', 'sriwulan', 'kendal', 'desa wisata', 'arenan'],
  openGraph: {
    title: 'Arenan Kalikesek | Desa Wisata Sriwulan',
    description:
      'Desa Wisata Arenan Kalikesek Sriwulan, Kecamatan Limbangan, Kabupaten Kendal, Jawa Tengah.',
    url: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: 'Arenan Kalikesek',
    locale: 'id_ID',
    type: 'website',
  },
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
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  )
}
