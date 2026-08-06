interface SectionProps {
  title?: string
  subtitle?: string
  className?: string
  children: React.ReactNode
  id?: string
  noReveal?: boolean
}

export default function Section({ title, subtitle, className = '', children, id, noReveal = false }: SectionProps) {
  return (
    <section id={id} className={`py-12 sm:py-16 md:py-24 ${className}`}>
      <div className="container-page">
        {(title || subtitle) && (
          <div className="mb-8 md:mb-14" data-reveal="up">
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
        )}
        {noReveal ? (
          <div>{children}</div>
        ) : (
          <div data-reveal="up" data-reveal-delay={title || subtitle ? '1' : '0'}>
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
