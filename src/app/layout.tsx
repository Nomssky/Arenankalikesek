import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Arenan Kalikesek - Desa Wisata Sriwulan',
  description:
    'Desa Wisata Arenan Kalikesek Sriwulan, Kecamatan Limbangan, Kabupaten Kendal, Jawa Tengah. Nikmati keindahan alam dan berbagai aktivitas wisata menarik.',
  keywords: ['wisata', 'kalikesek', 'sriwulan', 'kendal', 'desa wisata', 'arenan'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
