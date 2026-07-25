import Hero from '@/components/Hero'
import Section from '@/components/Section'

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
          <div className="card overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-900">Peta Penduduk</h3>
            </div>
            <div className="h-[360px] sm:h-[480px] lg:h-[620px]">
              <iframe
                width="100%"
                height="100%"
                src="https://arenankalikesek.com/wp-content/gismaps_maps/webgis_penduduk/qgis2web_2023_fix/index.html"
                className="w-full h-full"
                style={{ border: 0 }}
                title="Peta Penduduk"
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-900">Peta UMKM</h3>
            </div>
            <div className="h-[360px] sm:h-[480px] lg:h-[620px]">
              <iframe
                width="100%"
                height="100%"
                src="https://arenankalikesek.com/wp-content/gismaps_maps/webgis_umkm/qgis2web_2024/index.html"
                className="w-full h-full"
                style={{ border: 0 }}
                title="Peta UMKM"
              />
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
