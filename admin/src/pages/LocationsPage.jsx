import { useCallback, useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { deleteLocation, loadLocations, resolvePin, saveLocation } from '../api/locationsApi.js'
import CoverageMap from '../components/CoverageMap.jsx'

function blankDraft() {
  return { pin: '', name: '', radiusKm: '', subscription: true }
}

function coverage(location) {
  const parts = []
  if (location.pins?.length) parts.push(location.pins.join(', '))
  if (location.circle) parts.push(`${location.circle.radiusKm} km around ${location.circle.latitude}, ${location.circle.longitude}`)
  if (location.polygon?.length) parts.push(`${location.polygon.length}-point outline`)
  return parts.join(' · ') || 'No coverage set'
}

export default function LocationsPage() {
  const showToast = useToast()
  const [state, setState] = useState({ status: 'loading', locations: [], error: '' })
  const [open, setOpen] = useState('')
  const [draft, setDraft] = useState(blankDraft)
  const [place, setPlace] = useState(null)
  const [formError, setFormError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState('')
  const close = useCallback(() => setOpen(''), [])

  useEffect(() => {
    let cancel = false
    loadLocations().then((locations) => {
      if (!cancel) setState({ status: 'ready', locations, error: '' })
    }).catch((reason) => {
      if (!cancel) {
        setState({
          status: 'error',
          locations: [],
          error: reason instanceof Error ? reason.message : 'Locations could not be loaded.',
        })
      }
    })
    return () => {
      cancel = true
    }
  }, [])

  function update(event) {
    const { name, value, type, checked } = event.target
    setDraft((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    if (name === 'pin') setPlace(null)
  }

  function openAdd() {
    setDraft(blankDraft())
    setPlace(null)
    setFormError('')
    setOpen('add')
  }

  async function processPin(event) {
    event.preventDefault()
    const pin = draft.pin.replace(/\D/g, '')
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setFormError('Enter a 6-digit PIN code.')
      return
    }
    setFormError('')
    setProcessing(true)
    try {
      const resolved = await resolvePin(pin)
      setPlace(resolved)
      setDraft((current) => ({
        ...current,
        pin,
        name: resolved.locality || resolved.city || current.name,
      }))
    } catch (reason) {
      setPlace(null)
      setFormError(reason instanceof Error ? reason.message : 'This PIN could not be looked up.')
    } finally {
      setProcessing(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!place) {
      setFormError('Process the PIN code before saving.')
      return
    }
    const radius = Number(draft.radiusKm)
    if (!draft.name.trim() || draft.name.trim().length < 2) {
      setFormError('Enter a location name.')
      return
    }
    if (!Number.isFinite(radius) || radius <= 0 || radius > 100) {
      setFormError('Enter a radius between 0 and 100 kilometres.')
      return
    }
    if (!place.city || !place.state) {
      setFormError('This PIN did not include a city and state.')
      return
    }
    setFormError('')
    setSaving(true)
    try {
      const locations = await saveLocation({
        name: draft.name.trim(),
        city: place.city,
        state: place.state,
        pins: draft.pin,
        subscription: draft.subscription,
        circle: {
          latitude: place.latitude,
          longitude: place.longitude,
          radiusKm: radius,
        },
        polygon: null,
      })
      setState({ status: 'ready', locations, error: '' })
      setOpen('')
      showToast({ title: 'Location saved', message: 'Subscription checks now use this area.' })
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'This location could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    setSaving(true)
    try {
      const locations = await deleteLocation(id)
      setState({ status: 'ready', locations, error: '' })
      setConfirmId('')
      showToast({ title: 'Location removed', message: 'New subscriptions will no longer match this area.' })
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'This location could not be removed.')
    } finally {
      setSaving(false)
    }
  }

  const count = state.locations.length

  return (
    <>
      <DocumentTitle title="Locations" />
      <div className="page-heading">
        <p className="eyebrow">Subscriptions</p>
        <h1>Locations</h1>
        <p>
          Process a PIN code to place the area, then set how many kilometres around it can start a subscription. A day-to-day product order uses the customer’s address and is not limited to this list.
        </p>
      </div>
      {state.status === 'loading' ? <p role="status">Loading locations…</p> : null}
      {state.status === 'error' ? (
        <ErrorState title="Locations are unavailable" message={state.error} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
      ) : null}
      {state.status === 'ready' ? (
        <div className="location-actions">
          <button type="button" className={`location-badge${open === 'added' ? ' location-badge--active' : ''}`} onClick={() => { setFormError(''); setConfirmId(''); setOpen('added') }}>
            Added locations
            <span>{count}</span>
          </button>
          <button type="button" className={`location-badge${open === 'add' ? ' location-badge--active' : ''}`} onClick={openAdd}>
            Add new location
          </button>
        </div>
      ) : null}

      <Dialog open={open === 'added'} title="Added locations" onClose={close} className="dialog--locations">
        {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
        {count === 0 ? (
          <EmptyState title="No serviceable locations" message="Add a PIN code and a radius. Subscriptions can start only inside the areas you save." />
        ) : (
          <ul className="location-list">
            {state.locations.map((location) => {
              const confirming = confirmId === location.id
              return (
                <li key={location.id} className="panel location-card">
                  <div className="location-card__top">
                    <p className="eyebrow">{location.subscription ? 'Subscription on' : 'Subscription off'}</p>
                    <button
                      type="button"
                      className={`location-card__delete${confirming ? ' location-card__delete--confirm' : ''}`}
                      aria-label={confirming ? `Confirm delete ${location.name}` : `Delete ${location.name}`}
                      disabled={saving}
                      onClick={() => (confirming ? remove(location.id) : setConfirmId(location.id))}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                  <h2>{location.name}</h2>
                  <p>{location.city}{location.state ? `, ${location.state}` : ''}</p>
                  <p>{coverage(location)}</p>
                  {confirming ? <p className="location-card__confirm">Tap the icon again to delete.</p> : null}
                </li>
              )
            })}
          </ul>
        )}
      </Dialog>

      <Dialog open={open === 'add'} title="Add new location" onClose={close} className="dialog--map">
        <form className="add-location" onSubmit={place ? submit : processPin} noValidate>
          {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
          <div className="add-location__pin">
            <TextField
              id="location-pin"
              name="pin"
              label="PIN code"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              maxLength={6}
              hint="Process looks up the city, state, and map point for this PIN."
              value={draft.pin}
              onChange={(event) => update({
                target: { name: 'pin', value: event.target.value.replace(/\D/g, '').slice(0, 6), type: 'text' },
              })}
            />
            <Button type="button" className="add-location__process" variant={place ? 'outline' : 'primary'} disabled={processing} onClick={processPin}>
              {processing ? 'Processing…' : 'Process'}
            </Button>
          </div>
          {place ? (
            <div className="add-location__split">
              <div className="add-location__details">
                <div className="location-preview">
                  <p>{place.locality || place.city}</p>
                  <p>{[place.city, place.state, place.pin].filter(Boolean).join(', ')}</p>
                  <p>{Number(place.latitude).toFixed(5)}, {Number(place.longitude).toFixed(5)}</p>
                </div>
                <TextField id="location-name" name="name" label="Name" required value={draft.name} onChange={update} />
                <TextField
                  id="location-radius"
                  name="radiusKm"
                  label="Radius in kilometres"
                  inputMode="decimal"
                  required
                  hint="The map draws this distance around the PIN."
                  value={draft.radiusKm}
                  onChange={update}
                />
                <label className="check-row">
                  <input type="checkbox" name="subscription" checked={draft.subscription} onChange={update} />
                  <span>Subscriptions can be delivered here</span>
                </label>
                <Button type="submit" disabled={saving || processing}>{saving ? 'Saving…' : 'Save location'}</Button>
              </div>
              <CoverageMap latitude={Number(place.latitude)} longitude={Number(place.longitude)} radiusKm={draft.radiusKm} />
            </div>
          ) : null}
        </form>
      </Dialog>
    </>
  )
}
