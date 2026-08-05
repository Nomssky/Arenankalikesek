'use client'

import { useState, useRef, useEffect } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

function MapFrame({ src, title }: { src: string; title: string }) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading && iframeRef.current) {
        // Check if iframe loaded content
        try {
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
          if (!doc || !doc.body || doc.body.children.length === 0) {
            setHasError(true)
          }
        } catch (e) {
          // Likely CORS or X-Frame-Options blocking
          console.warn(`Map load timeout for ${title}:`, e)
          setHasError(true)
        }
      }
      setIsLoading(false)
    }, 5000)

    return () => clearTimeout(timer)
  }, [isLoading, title])

  return (
    <div className="card overflow-hidden">
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="h-[360px] sm:h-[480px] lg:h-[620px]">
        {hasError ? (
          <div className="flex items-center justify-center h-full bg-red-50 text-red-600 text-center p-4">
            <div>
              <p className="font-semibold">Peta tidak dapat dimuat</p>
              <p className="text-sm mt-1">Silakan muat ulang halaman atau hubungi pengelola</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full bg-gray-50 text-gray-400">
            <div className="animate-pulse text-center">
              <div className="text-sm">Memuat peta {title}...</div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            width="100%"
            height="100%"
            src={src}
            className="w-full h-full"
            style={{ border: 0 }}
            title={title}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
            allow="geolocation *; microphone *"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default function WebGISPage() {
  return (
    <>
      <Hero
        title="WebGIS"
        subtitle="Peta interaktif kawasan Arenan Kalikesek"
        image="/images/village-sign.jpg"
        height="md"
      />

      <Section title="Peta Wisata" subtitle="Jelajahi kawasan Arenan Kalikesek melalui peta interaktif">
        <div className="space-y-8">
          <MapFrame
            src="https://arenankalikesek.com/wp-content/gismaps_maps/webgis_penduduk/qgis2web_2023_fix/index.html"
            title="Peta Penduduk"
          />
          <MapFrame
            src="https://arenankalikesek.com/wp-content/gismaps_maps/webgis_umkm/qgis2web_2024/index.html"
            title="Peta UMKM"
          />
        </div>
      </Section>
    </>
  )
}
