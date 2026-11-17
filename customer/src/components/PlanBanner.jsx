import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const AUTO_MS = 3000

const slides = [
  {
    id: 'farm-journey',
    image: '/images/home-hero-farm-journey.jpg',
    title: 'From our fields to your family table.',
    body: 'Murrah buffalo milk and farm-fresh staples — raised with care, milked at dawn, and delivered across Visakhapatnam while the day is still young.',
    shade: 'deep',
    fit: 'contain',
    actions: 'journey',
  },
  {
    id: 'farm-morning',
    image: 'https://png.pngtree.com/thumb_back/fh260/background/20241224/pngtree-a-cow-dairy-farm-background-image-image_16856477.jpg',
    title: 'Fresh from the farm, at your door every morning.',
    body: 'Cow milk, curd, vegetables, and pantry staples. Subscribe for a daily drop, or place a quick order when you need something today.',
    shade: 'default',
    fit: 'cover',
    actions: 'morning',
  },
]

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function PlanBanner() {
  const [active, setActive] = useState(0)
  const timerRef = useRef(null)

  const goTo = useCallback((index) => {
    setActive((index + slides.length) % slides.length)
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (prefersReducedMotion()) return
    timerRef.current = setInterval(() => {
      setActive((current) => (current + 1) % slides.length)
    }, AUTO_MS)
  }, [])

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [resetTimer])

  return (
    <section
      className="farm-banner-slider"
      aria-roledescription="carousel"
      aria-label="Home page highlights"
      onMouseEnter={() => {
        if (timerRef.current) clearInterval(timerRef.current)
      }}
      onMouseLeave={resetTimer}
      onFocusCapture={() => {
        if (timerRef.current) clearInterval(timerRef.current)
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resetTimer()
      }}
    >
      <div
        className="farm-banner-slider__track"
        style={{ transform: `translate3d(-${active * 100}%, 0, 0)` }}
        aria-live="polite"
      >
        {slides.map((slide, index) => (
          <article
            key={slide.id}
            className={[
              'farm-banner',
              'farm-banner--slide',
              slide.shade === 'deep' ? 'farm-banner--shade-deep' : '',
              slide.fit === 'contain' ? 'farm-banner--fit-contain' : 'farm-banner--fit-cover',
            ].filter(Boolean).join(' ')}
            style={{ backgroundImage: `url(${slide.image})` }}
            aria-hidden={index !== active}
          >
            <div className="farm-banner__shade" aria-hidden="true" />
            <div className="farm-banner__copy">
              <h1>{slide.title}</h1>
              <p>{slide.body}</p>
              <div className="farm-banner__actions">
                {slide.actions === 'journey' ? (
                  <>
                    <Link className="farm-banner__btn farm-banner__btn--solid" to="/shop">
                      Shop farm-fresh
                    </Link>
                    <Link className="farm-banner__btn farm-banner__btn--line" to="/about">
                      Our story
                    </Link>
                  </>
                ) : (
                  <>
                    <Link className="farm-banner__btn farm-banner__btn--solid" to="/subscriptions">
                      Start a subscription
                    </Link>
                    <Link className="farm-banner__btn farm-banner__btn--line" to="/shop">
                      Shop now
                    </Link>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="farm-banner-slider__dots" role="tablist" aria-label="Choose slide">
        {slides.map((slide, index) => {
          const selected = index === active
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              className={selected ? 'farm-banner-slider__dot farm-banner-slider__dot--active' : 'farm-banner-slider__dot'}
              aria-selected={selected}
              aria-label={`Slide ${index + 1}: ${slide.title}`}
              onClick={() => {
                goTo(index)
                resetTimer()
              }}
            />
          )
        })}
      </div>
    </section>
  )
}