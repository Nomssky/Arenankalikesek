interface HeroProps {
  title: string
  subtitle?: string
  image?: string
  height?: 'sm' | 'md' | 'lg'
  children?: React.ReactNode
}

export default function Hero({ title, subtitle, image, height = 'md', children }: HeroProps) {
  const heights = {
    sm: 'min-h-[min(520px,62svh)] sm:min-h-[46vh]',
    md: 'min-h-[min(640px,72svh)] sm:min-h-[66vh]',
    lg: 'min-h-[max(640px,88svh)]',
  }

  const heroImage = image || '/images/village-landscape.jpg'

  return (
    <section
      className={`relative ${heights[height]} flex items-center justify-center overflow-hidden bg-emerald-950 text-white`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center scale-[1.02]"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#102d20]/70 via-[#102d20]/45 to-[#102d20]/75" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/30 to-transparent" />
      <div className={`relative z-10 container-page text-center ${height === 'lg' ? 'pb-14 pt-24' : 'pb-12 pt-24'}`}>
        <p className="mb-3 text-xs font-semibold tracking-[0.34em] text-orange-300 uppercase">Desa Wisata Sriwulan</p>
        <h1 className={`font-script mx-auto w-full max-w-full whitespace-normal text-orange-400 leading-[0.82] drop-shadow-lg ${height === 'lg' ? 'text-[clamp(3.5rem,16vw,8rem)]' : 'text-[clamp(3rem,15vw,4.5rem)]'}`}>
          {title.split(' ').map((word, index) => (
            <span key={`${word}-${index}`}>
              {index > 0 && (
                <>
                  <span className="hidden sm:inline"> </span>
                  <br className="sm:hidden" />
                </>
              )}
              {word}
            </span>
          ))}
        </h1>
        {subtitle && (
          <p className="text-sm md:text-base leading-7 text-white/85 max-w-2xl mx-auto mt-5 mb-8 text-balance">
            {subtitle}
          </p>
        )}
        {children}
      </div>
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center text-[10px] font-medium tracking-[0.24em] text-white/60 uppercase">
        <span className="block h-8 w-px bg-white/50 mx-auto mb-2" />
        Jelajahi
      </div>
    </section>
  )
}
