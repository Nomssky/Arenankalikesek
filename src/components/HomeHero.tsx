'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'

const slides = [
  {
    image: '/images/village-hero.jpg',
    eyebrow: 'Desa Wisata Arenan Kalikesek',
    subtitle:
      'Nikmati hangatnya kehidupan desa, udara pegunungan, dan keramahan warga di lereng Gunung Ungaran.',
  },
  {
    image: '/images/village-sign.jpg',
    eyebrow: 'Sriwulan, Limbangan, Kendal',
    subtitle:
      'Satu tempat untuk wisata alam, edukasi pertanian, tradisi, kuliner, dan pengalaman desa yang autentik.',
  },
  {
    image: '/images/village-landscape.jpg',
    eyebrow: 'Kembali dekat dengan alam',
    subtitle:
      'Jelajahi persawahan, sungai yang jernih, dan aktivitas lokal yang dirancang untuk keluarga maupun rombongan.',
  },
]

export default function HomeHero() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length)
    }, 6500)

    return () => window.clearInterval(timer)
  }, [paused])

  const goToPrevious = () => {
    setActiveSlide((current) => (current - 1 + slides.length) % slides.length)
  }

  const goToNext = () => {
    setActiveSlide((current) => (current + 1) % slides.length)
  }

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="home-hero relative flex min-h-[max(640px,100svh)] items-center overflow-hidden bg-emerald-950 md:min-h-[820px] lg:min-h-[max(760px,100svh)]">
      {slides.map((slide, index) => (
        <div
          key={slide.image}
          className={`home-hero__slide absolute inset-0 overflow-hidden ${
            activeSlide === index ? 'home-hero__slide--active' : ''
          }`}
          aria-hidden={activeSlide !== index}
        >
          <div
            className="home-hero__media absolute -inset-y-[8%] inset-x-0 bg-cover bg-center"
            data-parallax-media
            style={{ backgroundImage: `url(${slide.image})` }}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,30,17,0.82)_0%,rgba(8,30,17,0.42)_52%,rgba(8,30,17,0.2)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/65 via-transparent to-black/25" />

      <div className="container-page relative z-10 w-full pb-16 pt-24 sm:pb-20">
        <div key={activeSlide} className="home-hero__copy max-w-3xl text-white">
          <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md min-[380px]:px-4 min-[380px]:text-[10px] sm:mb-5 sm:text-xs">
            <MapPinIcon className="h-4 w-4 text-orange-400" />
            {slides[activeSlide].eyebrow}
          </div>

          <h1 className="font-script max-w-full text-[clamp(4rem,18vw,7.5rem)] leading-[0.82] text-orange-400 drop-shadow-[0_5px_18px_rgba(0,0,0,0.4)]">
            Arenan Kalikesek
          </h1>
          <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-white/90 min-[380px]:text-base min-[380px]:leading-8 sm:mt-7 sm:text-lg md:text-xl md:leading-9">
            {slides[activeSlide].subtitle}
          </p>

          <div className="mt-7 flex w-full max-w-sm flex-col gap-3 sm:mt-9 sm:max-w-none sm:flex-row">
            <Link href="/wisata" className="btn-secondary">
              Jelajahi Wisata
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/booking/wisata"
              className="inline-flex items-center justify-center rounded-full border border-white/45 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white hover:text-emerald-900"
            >
              Booking Sekarang
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Slide sebelumnya"
        onClick={goToPrevious}
        className="absolute left-5 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/15 text-white backdrop-blur-sm transition hover:bg-orange-500 lg:flex"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Slide berikutnya"
        onClick={goToNext}
        className="absolute right-5 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/15 text-white backdrop-blur-sm transition hover:bg-orange-500 lg:flex"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>

      <div className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.image}
            type="button"
            aria-label={`Buka slide ${index + 1}`}
            onClick={() => setActiveSlide(index)}
            className={`h-2.5 rounded-full transition-all ${
              activeSlide === index ? 'w-9 bg-orange-400' : 'w-2.5 bg-white/55 hover:bg-white'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
