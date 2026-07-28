'use client'

import { usePathname } from 'next/navigation'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import MotionExperience from '@/components/MotionExperience'
import PageTransition from '@/components/PageTransition'

export default function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <MotionExperience>
      <div className="flex min-h-screen flex-col">
        {!isAdmin && <Header />}
        <PageTransition>{children}</PageTransition>
        {!isAdmin && <Footer />}
      </div>
    </MotionExperience>
  )
}
