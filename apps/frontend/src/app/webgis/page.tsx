'use client'

import { useState, useEffect } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

function MapFrame({ src, title }: { src: string; title: string }) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Jangan akses contentDocument untuk iframe cross-origin: selalu throws
    // SecurityError dan memicu false-error. Batasi deteksi hanya pada onLoad/onError.
    const timer = setTimeout(() => setIsLoading(false), 8000)
    return () => clearTimeout(timer)
  }, [src])

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 p-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Buka peta di tab baru
        </a>
      </div>
      <div className="h-[360px] sm:h-[480px] lg:h-[620px]">
        {hasError ? (
          <div className="flex h-full items-center justify-center bg-red-50 p-4 text-center text-red-600">
            <div>
              <p className="font-semibold">Peta tidak dapat dimuat di dalam halaman</p>
              <p className="mt-1 text-sm">
                Beberapa peta memblokir embed (X-Frame-Options).{' '}
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-red-700 underline"
                >
                  Buka di tab baru
                </a>{' '}
                untuk melihat peta.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400">
            <div className="animate-pulse text-center">
              <div className="text-sm">Memuat peta {title}...</div>
            </div>
          </div>
        ) : (
          <iframe
            width="100%"
            height="100%"
            src={src}
            className="h-full w-full"
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

      <Section title="Peta Wisata" subtitle="Jelajahi kawasan Arenan Kalikesek melalui peta interaktif" noReveal>
        <div className="space-y-8">
          <MapFrame
            src="/webgis/penduduk/index.html"
            title="Peta Penduduk"
          />
          <MapFrame
            src="/webgis/umkm/index.html"
            title="Peta UMKM"
          />
          <MapFrame
            src="/webgis/wisata/index.html"
            title="Peta Wisata Alam Hutan Pinus"
          />
        </div>
      </Section>
    </>
  )
}
