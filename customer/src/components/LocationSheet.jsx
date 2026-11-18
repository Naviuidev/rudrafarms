import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import { useShop } from '../context/shopContext.js'

export default function LocationSheet({ open, onClose }) {
  const {
    serviceLocations,
    setDeliveryPoint,
    setDeliveryLocation,
    deliveryLocation,
  } = useShop()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function pickArea(location) {
    if (!location?.center) return
    setError('')
    setBusy(true)
    try {
      const pin = Array.isArray(location.pins) ? String(location.pins[0] || '') : ''
      const label = [location.name, location.city].filter(Boolean).join(', ')
      setDeliveryLocation(location.id)
      setDeliveryPoint({
        latitude: location.center.latitude,
        longitude: location.center.longitude,
        pin,
        label,
      })
      onClose()
    } catch {
      setError('Could not select this area.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Delivery location" onClose={onClose} className="dialog--location">
      <p className="location-sheet__lead">
        We deliver in Visakhapatnam (Vizag) only. Choose a store delivery area below.
        {' '}
        For a saved home address, use
        {' '}
        <Link className="location-sheet__inline" to="/account?tab=addresses" onClick={onClose}>Addresses</Link>
        .
      </p>
      {error ? <p className="field__error" role="alert">{error}</p> : null}

      {serviceLocations.length > 0 ? (
        <section className="location-sheet__block" aria-label="Store delivery areas">
          <p className="location-sheet__label">Store delivery areas</p>
          <ul className="location-sheet__list location-sheet__list--areas">
            {serviceLocations.map((location) => {
              const meta = [location.city, location.state].filter(Boolean).join(', ')
              const active = deliveryLocation?.id === location.id
              return (
                <li key={location.id}>
                  <Button
                    type="button"
                    variant={active ? 'primary' : 'outline'}
                    className="location-sheet__area-btn"
                    disabled={busy}
                    onClick={() => pickArea(location)}
                  >
                    <span className="location-sheet__area-name">{location.name}</span>
                    {meta ? <span className="location-sheet__area-meta">{meta}</span> : null}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <p className="location-sheet__empty">No delivery areas are available right now. Please try again later.</p>
      )}
    </Dialog>
  )
}