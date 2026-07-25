import type { ServiceCategory } from '@/lib/service-categories'

interface CategoryVisualHeaderProps {
  category: ServiceCategory
  compact?: boolean
}

export default function CategoryVisualHeader({
  category,
  compact = false,
}: CategoryVisualHeaderProps) {
  return (
    <div
      key={category.id}
      className={`relative isolate mb-8 overflow-hidden rounded-[1.75rem] bg-emerald-950 shadow-[0_20px_55px_-34px_rgba(12,54,27,0.75)] ${
        compact ? 'min-h-[190px]' : 'min-h-[240px] sm:min-h-[280px]'
      }`}
    >
      <div
        className="absolute inset-0 -z-20 bg-cover transition-all duration-500"
        style={{
          backgroundImage: `url(${category.image})`,
          backgroundPosition: category.position || 'center',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-950/90 via-emerald-950/62 to-emerald-950/20" />
      <div className="absolute inset-0 flex items-end p-6 text-white sm:p-8">
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300">
            Pilihan layanan
          </p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{category.name}</h2>
          <p className="mt-3 text-sm leading-7 text-white/80">{category.description}</p>
        </div>
      </div>
    </div>
  )
}
