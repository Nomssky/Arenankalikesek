interface SectionProps {
  title?: string
  subtitle?: string
  className?: string
  children: React.ReactNode
  id?: string
}

export default function Section({ title, subtitle, className = '', children, id }: SectionProps) {
  return (
    <section id={id} className={`py-12 sm:py-16 md:py-24 ${className}`}>
      <div className="container-page">
        {(title || subtitle) && (
          <div className="mb-8 md:mb-14">
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
