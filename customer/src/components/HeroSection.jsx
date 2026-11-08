import { useEffect, useMemo, useState } from 'react'
import Button from '@brand/components/Button.jsx'

export default function HeroSection({ hero }) {
  const [slide, setSlide] = useState(0)
  const layout = ['split', 'banner', 'portrait', 'center'].includes(hero.layout) ? hero.layout : 'split'
  const slides = useMemo(
    () => (hero.backgroundMode === 'slider' ? (hero.sliderImages || []).filter(Boolean) : []),
    [hero.backgroundMode, hero.sliderImages],
  )
  const activeBadges = (hero.badges || []).filter((badge) => badge.enabled && (badge.title || badge.subtitle || badge.image))
  const showArt = (layout === 'split' || layout === 'portrait') && hero.showHeroImage !== false && hero.heroImage

  useEffect(() => {
    if (slides.length < 2) return undefined
    const timer = setInterval(() => {
      setSlide((current) => (current + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  const backgroundImage = useMemo(() => {
    if (hero.backgroundMode === 'slider' && slides.length > 0) return slides[slide]
    if (hero.backgroundImage) return hero.backgroundImage
    if (layout !== 'split' && hero.heroImage) return hero.heroImage
    return ''
  }, [hero.backgroundMode, hero.backgroundImage, hero.heroImage, layout, slides, slide])

  return (
    <section
      className={`hero hero--layout-${layout}${backgroundImage ? ' hero--has-bg' : ''}`}
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      {hero.backgroundMode === 'slider' && slides.length > 1 ? (
        <div className="hero__slider-dots" aria-hidden="true">
          {slides.map((src, index) => (
            <span key={src} className={index === slide ? 'hero__slider-dot hero__slider-dot--active' : 'hero__slider-dot'} />
          ))}
        </div>
      ) : null}
      <div className="container hero__grid">
        <div className="hero__copy">
          {hero.eyebrow ? <p className="eyebrow">{hero.eyebrow}</p> : null}
          {hero.title ? <h1>{hero.title}</h1> : null}
          {hero.description ? <p>{hero.description}</p> : null}
          {(hero.primaryCta?.label || hero.secondaryCta?.label) ? (
            <div className="hero__actions">
              {hero.primaryCta?.label ? (
                <Button to={hero.primaryCta.to || '/shop'}>{hero.primaryCta.label}</Button>
              ) : null}
              {hero.secondaryCta?.label ? (
                <Button variant="secondary" to={hero.secondaryCta.to || '/shop'}>{hero.secondaryCta.label}</Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {showArt ? (
          <div className="hero__art">
            <img src={hero.heroImage} width="880" height="680" alt={hero.heroImageAlt || ''} />
            {layout === 'split' ? activeBadges.map((badge, index) => (
              <div
                key={`${badge.title}:${index}`}
                className={index === 0 ? 'hero__float' : 'hero__badge'}
              >
                {badge.image ? <img src={badge.image} alt="" className="hero__badge-img" /> : null}
                {badge.title ? <strong>{badge.title}</strong> : null}
                {badge.subtitle ? <span>{badge.subtitle}</span> : null}
              </div>
            )) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function HeroSectionPreview({ hero }) {
  return (
    <div className="hero-preview-shell">
      <HeroSection hero={hero} />
      <p className="hero-preview-note">Preview matches the storefront home hero.</p>
    </div>
  )
}
