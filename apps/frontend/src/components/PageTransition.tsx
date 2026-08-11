'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type TransitionPhase = 'idle' | 'covering' | 'revealing'

const routeLabels: Record<string, string> = {
  '/': 'Beranda',
  '/wisata': 'Wisata',
  '/jadwal': 'Jadwal',
  '/toko': 'Toko',
  '/blog': 'Blog',
  '/kontak': 'Kontak',
  '/webgis': 'WebGIS',
  '/eduwisata-gula-aren': 'Eduwisata',
}

const motionLightRoutes = ['/admin', '/booking', '/invoice', '/toko/checkout']

function usesLightMotion(pathname: string) {
  return motionLightRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function getRouteLabel(pathname: string) {
  const exactLabel = routeLabels[pathname]
  if (exactLabel) return exactLabel

  const parentRoute = Object.keys(routeLabels)
    .filter((route) => route !== '/' && pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0]

  return parentRoute ? routeLabels[parentRoute] : 'Arenan Kalikesek'
}

function isInternalNavigation(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    anchor.target === '_blank' ||
    anchor.hasAttribute('download') ||
    anchor.dataset.transition === 'off'
  ) {
    return false
  }

  const href = anchor.getAttribute('href')
  return Boolean(href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:'))
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const mainRef = useRef<HTMLElement>(null)
  const timersRef = useRef<number[]>([])
  const transitionActiveRef = useRef(false)
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const [destination, setDestination] = useState('Arenan Kalikesek')
  const lightMotion = usesLightMotion(pathname)

  useEffect(() => {
    if (lightMotion) return

    const clearTimers = () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }

    const handleNavigation = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || !isInternalNavigation(event, anchor)) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (usesLightMotion(url.pathname)) return

      const currentUrl = new URL(window.location.href)
      const currentDocument = `${currentUrl.pathname}${currentUrl.search}`
      const nextDocument = `${url.pathname}${url.search}`

      if (currentDocument === nextDocument) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      event.preventDefault()
      if (transitionActiveRef.current) return

      transitionActiveRef.current = true
      clearTimers()
      setDestination(getRouteLabel(url.pathname))
      setPhase('covering')
      document.documentElement.dataset.routeTransition = 'active'

      timersRef.current.push(
        window.setTimeout(() => {
          router.push(`${url.pathname}${url.search}${url.hash}`)
        }, 420),
        window.setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          setPhase('revealing')
        }, 540),
        window.setTimeout(() => {
          setPhase('idle')
          transitionActiveRef.current = false
          delete document.documentElement.dataset.routeTransition
        }, 1190)
      )
    }

    document.addEventListener('click', handleNavigation)
    return () => {
      document.removeEventListener('click', handleNavigation)
      clearTimers()
      transitionActiveRef.current = false
      delete document.documentElement.dataset.routeTransition
    }
  }, [lightMotion, router])

  useEffect(() => {
    if (lightMotion) return

    const root = mainRef.current
    if (!root) return

    let intersectionObserver: IntersectionObserver | null = null
    let mutationObserver: MutationObserver | null = null

    // Give nested client boundaries time to hydrate before adding reveal classes.
    // Mutating SSR markup too early can otherwise trigger a hydration mismatch.
    const startTimer = window.setTimeout(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const observedElements = new WeakSet<Element>()

      const revealElement = (element: Element) => {
        element.classList.add('is-revealed')
      }

      if (!reducedMotion && 'IntersectionObserver' in window) {
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return
              revealElement(entry.target)
              intersectionObserver?.unobserve(entry.target)
            })
          },
          {
            threshold: 0,
            rootMargin: '0px 0px -7% 0px',
          }
        )
      }

      const registerElement = (element: Element) => {
        if (observedElements.has(element)) return
        observedElements.add(element)

        const bounds = element.getBoundingClientRect()
        const isAlreadyVisible =
          bounds.top < window.innerHeight * 0.94 && bounds.bottom > 0

        // Elements already in the viewport use their normal visible CSS state.
        // Adding a class here would race with hydration on data-driven pages.
        if (reducedMotion || !intersectionObserver || isAlreadyVisible) {
          return
        }

        element.classList.add('reveal-pending')
        intersectionObserver.observe(element)
      }

      const register = (scope: ParentNode) => {
        scope.querySelectorAll('[data-reveal]').forEach(registerElement)
      }

      register(root)

      mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return
            if (node.matches('[data-reveal]')) registerElement(node)
            register(node)
          })
        })
      })

      mutationObserver.observe(root, { childList: true, subtree: true })
    }, 1200)

    return () => {
      window.clearTimeout(startTimer)
      intersectionObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [lightMotion, pathname])

  return (
    <>
      <main
        key={pathname}
        ref={mainRef}
        className={`${lightMotion ? '' : 'route-page'} min-w-0 flex-1`}
      >
        {children}
      </main>

      <div
        className={`route-curtain route-curtain--${phase}`}
        aria-hidden="true"
      >
        <div className="route-curtain__texture" />
        <div className="route-curtain__content">
          <span className="route-curtain__eyebrow">Menuju</span>
          <span className="route-curtain__label">{destination}</span>
          <span className="route-curtain__mark">
            {Array.from({ length: 10 }, (_, index) => (
              <i key={index} style={{ transform: `rotate(${index * 36}deg)` }} />
            ))}
          </span>
        </div>
      </div>
    </>
  )
}
