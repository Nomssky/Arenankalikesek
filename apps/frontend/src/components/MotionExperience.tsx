'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const motionLightRoutes = ['/admin', '/booking', '/invoice', '/toko/checkout']

function usesNativeScroll(pathname: string) {
  return motionLightRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function LenisScrollSync() {
  useLenis(() => {
    ScrollTrigger.update()
  })

  return null
}

function ScrollEffects({ disabled }: { disabled: boolean }) {
  const pathname = usePathname()

  useEffect(() => {
    if (disabled) return

    const context = gsap.context(() => {
      const media = gsap.matchMedia()

      media.add(
        {
          desktop: '(min-width: 768px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (matchContext) => {
          const { desktop, reduceMotion } = matchContext.conditions as {
            desktop: boolean
            reduceMotion: boolean
          }

          if (reduceMotion) return

          if (desktop) {
            gsap.utils.toArray<HTMLElement>('[data-parallax-media]').forEach((element) => {
              gsap.fromTo(
                element,
                { yPercent: -2 },
                {
                  yPercent: 7,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: element.closest('section') || element,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 0.65,
                    invalidateOnRefresh: true,
                  },
                }
              )
            })
          }

          gsap.utils
            .toArray<HTMLElement>('[data-gallery-reveal]')
            .forEach((container) => {
              const image = container.querySelector<HTMLElement>('[data-gallery-media]')
              const timeline = gsap.timeline({
                scrollTrigger: {
                  trigger: container,
                  start: 'top 88%',
                  once: true,
                },
              })

              timeline.fromTo(
                container,
                { clipPath: 'inset(0 0 14% 0 round 1.5rem)' },
                {
                  clipPath: 'inset(0 0 0% 0 round 1.5rem)',
                  duration: 0.82,
                  ease: 'power3.out',
                }
              )

              if (image) {
                timeline.fromTo(
                  image,
                  { scale: 1.08 },
                  { scale: 1, duration: 1.05, ease: 'power3.out' },
                  0
                )

                if (desktop) {
                  gsap.fromTo(
                    image,
                    { yPercent: -1.5 },
                    {
                      yPercent: 2.5,
                      ease: 'none',
                      scrollTrigger: {
                        trigger: container,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: 0.8,
                      },
                    }
                  )
                }
              }
            })

          gsap.utils.toArray<HTMLElement>('[data-footer-reveal]').forEach((footer) => {
            gsap.fromTo(
              footer,
              { opacity: 0, y: 28 },
              {
                opacity: 1,
                y: 0,
                duration: 0.78,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: footer,
                  start: 'top 94%',
                  once: true,
                },
              }
            )
          })
        }
      )
    })

    const refresh = () => ScrollTrigger.refresh()
    const refreshTimer = window.setTimeout(refresh, 450)
    window.addEventListener('load', refresh, { once: true })

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('load', refresh)
      context.revert()
    }
  }, [disabled, pathname])

  return null
}

export default function MotionExperience({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [reducedMotion, setReducedMotion] = useState(false)
  const disabled = usesNativeScroll(pathname) || reducedMotion

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setReducedMotion(mediaQuery.matches)

    syncPreference()
    mediaQuery.addEventListener('change', syncPreference)
    return () => mediaQuery.removeEventListener('change', syncPreference)
  }, [])

  if (disabled) {
    return (
      <>
        <ScrollEffects disabled />
        {children}
      </>
    )
  }

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        duration: 1.02,
        smoothWheel: true,
        syncTouch: false,
        anchors: { offset: -96 },
        prevent: (node) =>
          Boolean(
            node.closest(
              '[data-lenis-prevent], [role="dialog"], [data-scroll-container]'
            )
          ),
      }}
    >
      <LenisScrollSync />
      <ScrollEffects disabled={false} />
      {children}
    </ReactLenis>
  )
}
