import { useEffect, useRef, useState } from 'react'
import { useShop } from '../context/shopContext.js'

function prefersHoverMenu() {
  return typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export default function DeliveryLocationMenu() {
  const {
    deliveryLocation,
    serviceLocations,
    locationsReady,
    setDeliveryLocation,
  } = useShop()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label = deliveryLocation?.name || (locationsReady ? 'Choose location' : 'Loading…')

  function toggleMenu() {
    if (prefersHoverMenu()) return
    setOpen((current) => !current)
  }

  function pick(id) {
    setDeliveryLocation(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`location-menu${open ? ' location-menu--open' : ''}`}>
      <button
        type="button"
        className="tool location-menu__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={toggleMenu}
        disabled={!locationsReady || serviceLocations.length === 0}
      >
        <PinIcon />
        <span className="tool__label">{label}</span>
      </button>
      <div className="location-menu__drop">
        <div className="location-menu__panel" role="listbox" aria-label="Delivery locations">
          {serviceLocations.length === 0 ? (
            <p className="location-menu__empty">No delivery locations are configured yet.</p>
          ) : (
            serviceLocations.map((location) => {
              const active = location.id === deliveryLocation?.id
              const meta = [location.city, location.state].filter(Boolean).join(', ')
              return (
                <button
                  key={location.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? 'location-menu__item location-menu__item--active' : 'location-menu__item'}
                  onClick={() => pick(location.id)}
                >
                  <strong>{location.name}</strong>
                  {meta ? <span>{meta}</span> : null}
                  {location.subscription ? <span className="location-menu__tag">Subscription zone</span> : null}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
    </svg>
  )
}
