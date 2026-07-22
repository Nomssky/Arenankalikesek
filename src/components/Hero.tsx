interface HeroProps {
  title: string
  subtitle?: string
  image?: string
  height?: 'sm' | 'md' | 'lg'
  children?: React.ReactNode
}

export default function Hero({ title, subtitle, image, height = 'md', children }: HeroProps) {
  const heights = {
    sm: 'min-h-[40vh]',
    md: 'min-h-[60vh]',
    lg: 'min-h-[80vh]',
  }

  return (
    <section
      className={`relative ${heights[height]} flex items-center justify-center bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 text-white`}
    >
      {image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}
      <div className="relative z-10 container-page text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg md:text-xl text-emerald-100 max-w-3xl mx-auto mb-8">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}
