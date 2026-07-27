'use client'

import { useState } from 'react'
import Hero from '@/components/Hero'
import Section from '@/components/Section'

function MapFrame({ src, title }: { src: string; title: string }) {
  const [hasError, setHasError] = useState(false)

  return (
    <div className="card overflow-hidden">
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="h-[360px] sm:h-[480px] lg:h-[620px]">
        {hasError ? (
          <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">
            Peta tidak dapat dimuat
          </div>
        ) : (
          <iframe
            width="100%"
            height="100%"
            src={src}
            className="w-full h-full"
            style={{ border: 0 }}
            title={title}
            onError={() => setHasError(true)}
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
        height="sm"
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
