import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { checkServiceability, resolveLocation } from '../api/locationApi.js'
import { useShop } from '../context/shopContext.js'

export default function LocationSheet({ open, onClose }) {
  const {
    addresses,
    serviceLocations,
    setDeliveryPoint,
    setDeliveryLocation,
    setDefaultAddress,
    applyDeliveryFromGps,
    deliveringAddressId,
    deliveryMode,
  } = useShop()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function useGps() {
    setError('')
    setBusy(true)
    try {
      await applyDeliveryFromGps()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Location could not be detected.')
    } finally {
      setBusy(false)
    }
  }

  async function usePin() {
    const code = pin.replace(/\D/g, '')
    if (!/^[1-9][0-9]{5}$/.test(code)) {
      setError('Enter a 6-digit PIN.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const resolved = await resolveLocation({ pin: code })
      if (!resolved?.found) {
        setError(resolved?.message || 'PIN could not be found.')
        return
      }
      const service = await checkServiceability(
        { latitude: resolved.latitude, longitude: resolved.longitude, pin: resolved.pin || code },
        'checkout',
      )
      if (!service.allowed) {
        setError(service.message || 'We deliver only in Visakhapatnam (Vizag).')
        return
      }
      const label = [resolved.city, resolved.pin || code].filter(Boolean).join(', ')
      setDeliveryPoint({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        pin: resolved.pin || code,
        label,
      })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PIN lookup failed.')
    } finally {
      setBusy(false)
    }
  }

  async function pickAddress(id) {
    setBusy(true)
    try {
      await setDefaultAddress(id)
      onClose()
    } catch {
      setError('Could not select this address.')
    } finally {
      setBusy(false)
    }
  }

  function pickArea(location) {
    if (!location?.center) return
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
  }

  return (
    <Dialog open={open} title="Delivery location" onClose={onClose} className="dialog--location">
      <p className="location-sheet__lead">
        We deliver in Visakhapatnam (Vizag) only. Prices depend on where you are. Saved addresses sync with
        {' '}
        <Link className="location-sheet__inline" to="/account?tab=addresses" onClick={onClose}>Addresses</Link>
        .
      </p>
      {error ? <p className="field__error" role="alert">{error}</p> : null}

      <div className="location-sheet__actions">
        <Button type="button" className="sub-cta" disabled={busy} onClick={useGps}>
          {busy ? 'Please wait…' : 'Use my location'}
        </Button>
        <div className="location-sheet__pin">
          <TextField
            id="location-sheet-pin"
            label="PIN code"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={usePin}>Go</Button>
        </div>
      </div>

      {addresses.length > 0 ? (
        <section className="location-sheet__block" aria-label="Saved addresses">
          <p className="location-sheet__label">Saved addresses</p>
          <ul className="location-sheet__list">
            {addresses.map((address) => {
              const active = deliveryMode === 'saved' && deliveringAddressId === address.id
              return (
                <li key={address.id}>
                  <button
                    type="button"
                    className={active ? 'location-sheet__pick location-sheet__pick--active' : 'location-sheet__pick'}
                    disabled={busy}
                    onClick={() => pickAddress(address.id)}
                  >
                    <strong>{address.line1}</strong>
                    <span>{[address.city, address.pin].filter(Boolean).join(' ')}</span>
                    {active ? <span className="location-sheet__tag">Delivering here</span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {serviceLocations.length > 0 ? (
        <section className="location-sheet__block" aria-label="Store areas">
          <p className="location-sheet__label">Store delivery areas</p>
          <ul className="location-sheet__list">
            {serviceLocations.map((location) => (
              <li key={location.id}>
                <button type="button" className="location-sheet__pick" disabled={busy} onClick={() => pickArea(location)}>
                  <strong>{location.name}</strong>
                  <span>{[location.city, location.state].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="location-sheet__footer">
        <Link className="location-sheet__link" to="/addresses/new" onClick={onClose}>Add address</Link>
        <Link className="location-sheet__link" to="/account?tab=addresses" onClick={onClose}>Manage all addresses</Link>
      </div>
    </Dialog>
  )
}
