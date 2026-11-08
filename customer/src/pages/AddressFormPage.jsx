import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { SelectField, TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { checkServiceability, resolveLocation, searchPlaces } from '../api/locationApi.js'
import LocationMap from '../components/LocationMap.jsx'
import ServiceabilityStatus from '../components/ServiceabilityStatus.jsx'
import { useShop } from '../context/shopContext.js'

const states = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Delhi', 'Puducherry',
]

const types = [
  { id: 'home', title: 'Home' },
  { id: 'work', title: 'Work' },
  { id: 'other', title: 'Other' },
]

function blankForm() {
  return {
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: 'Tamil Nadu',
    pin: '',
    latitude: null,
    longitude: null,
    type: 'home',
    contactName: '',
    contactPhone: '',
  }
}

function formFrom(address) {
  return {
    line1: address.line1,
    line2: address.line2 || '',
    landmark: address.landmark || '',
    city: address.city,
    state: address.state,
    pin: address.pin,
    latitude: address.latitude,
    longitude: address.longitude,
    type: address.type,
    contactName: address.contactName,
    contactPhone: address.contactPhone,
  }
}

export default function AddressFormPage() {
  const { id } = useParams()
  const { addresses } = useShop()
  const existing = id ? addresses.find((item) => item.id === id) : null

  if (id && !existing) {
    return (
      <section className="section">
        <DocumentTitle title="Address" />
        <div className="container narrow">
          <EmptyState
            title="Address not found"
            message="That saved address is no longer on this device."
            action={<Button to="/addresses">View addresses</Button>}
          />
        </div>
      </section>
    )
  }

  return <AddressEditor key={id || 'new'} address={existing} />
}

function AddressEditor({ address }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { saveAddress, serviceLocations } = useShop()
  const showToast = useToast()
  const [values, setValues] = useState(() => (address ? formFrom(address) : blankForm()))
  const [errors, setErrors] = useState({})
  const [checked, setChecked] = useState({ pointKey: '', service: null, error: '' })
  const [locateError, setLocateError] = useState('')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [placesAvailable, setPlacesAvailable] = useState(null)
  const [placeQuery, setPlaceQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [areaPrompt, setAreaPrompt] = useState(false)
  const [areaQuery, setAreaQuery] = useState('')
  const [chosenArea, setChosenArea] = useState(null)

  useEffect(() => {
    let cancel = false
    searchPlaces('').then((result) => {
      if (!cancel) setPlacesAvailable(result.available)
    }).catch(() => {
      if (!cancel) setPlacesAvailable(false)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!placesAvailable || placeQuery.trim().length < 3) return undefined
    let cancel = false
    const timer = setTimeout(() => {
      searchPlaces(placeQuery.trim()).then((result) => {
        if (!cancel) setSuggestions(result.suggestions)
      }).catch((reason) => {
        if (!cancel) setLocateError(reason instanceof Error ? reason.message : 'Place search is unavailable right now.')
      })
    }, 300)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [placeQuery, placesAvailable])

  const latitude = values.latitude
  const longitude = values.longitude
  const pointKey = latitude == null || longitude == null ? '' : `${latitude},${longitude}`
  const checking = pointKey !== '' && checked.pointKey !== pointKey

  useEffect(() => {
    if (!pointKey) return undefined
    let cancel = false
    checkServiceability({ latitude, longitude }, 'address').then((service) => {
      if (!cancel) setChecked({ pointKey, service, error: '' })
    }).catch((reason) => {
      if (!cancel) {
        setChecked({
          pointKey,
          service: null,
          error: reason instanceof Error ? reason.message : 'The store could not check this location.',
        })
      }
    })
    return () => {
      cancel = true
    }
  }, [pointKey, latitude, longitude])

  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  function applyResolved(resolved) {
    setValues((current) => ({
      ...current,
      city: resolved.city || current.city,
      state: resolved.state || current.state,
      pin: resolved.pin || current.pin,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    }))
    setLocateError('')
  }

  async function placeFrom(payload) {
    setLocating(true)
    setLocateError('')
    try {
      const resolved = await resolveLocation(payload)
      if (!resolved?.found) {
        setLocateError(resolved?.message || 'The store could not place this location.')
        return
      }
      applyResolved(resolved)
    } catch (reason) {
      setLocateError(reason instanceof Error ? reason.message : 'The store could not place this location.')
    } finally {
      setLocating(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError('This browser cannot share a location. Enter a PIN code or drop a map pin.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        placeFrom({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {
        setLocating(false)
        setLocateError('Location permission is needed, or enter a PIN code.')
      },
    )
  }

  function findPin() {
    if (!/^[1-9][0-9]{5}$/.test(values.pin)) {
      setErrors((current) => ({ ...current, pin: 'Enter a 6-digit PIN code.' }))
      return
    }
    setErrors((current) => ({ ...current, pin: '' }))
    placeFrom({ pin: values.pin })
  }

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (values.line1.trim().length < 5) next.line1 = 'Enter the house number and street.'
    if (values.city.trim().length < 2) next.city = 'Enter the city.'
    if (!values.state) next.state = 'Choose a state.'
    if (!/^[1-9][0-9]{5}$/.test(values.pin)) next.pin = 'Enter a 6-digit PIN code.'
    const missingPoint = values.latitude == null || values.longitude == null
    if (values.contactName.trim().length < 2) next.contactName = 'Enter the contact person.'
    if (!/^[6-9]\d{9}$/.test(values.contactPhone)) next.contactPhone = 'Enter a 10-digit mobile number.'
    setErrors(next)
    if (Object.keys(next).length) return
    if (missingPoint) {
      setAreaPrompt('point')
      return
    }

    setSaving(true)
    try {
      const service = checked.service?.subscription == null
        ? await checkServiceability({
          latitude: values.latitude,
          longitude: values.longitude,
          pin: values.pin,
        }, 'subscription')
        : checked.service
      if (!service.subscription) {
        setAreaPrompt('outside')
        return
      }
      await saveAddress({ ...values, id: address?.id })
      showToast({
        title: 'Address saved',
        message: 'Subscription delivery is available for this address.',
      })
      const from = location.state?.from
      if (typeof from === 'string' && from.startsWith('/')) {
        navigate(from, { replace: true })
        return
      }
      const index = window.history.state?.idx
      if (typeof index === 'number' && index > 0) {
        navigate(-1)
        return
      }
      navigate('/subscriptions', { replace: true })
    } catch (reason) {
      setErrors({ form: reason instanceof Error ? reason.message : 'This address could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  function chooseArea(item) {
    const pin = Array.isArray(item.pins) ? String(item.pins[0] || '') : ''
    setValues((current) => ({
      ...current,
      line1: '',
      line2: '',
      landmark: '',
      city: item.city || current.city,
      state: item.state || current.state,
      pin: pin || current.pin,
      latitude: item.center.latitude,
      longitude: item.center.longitude,
    }))
    setChosenArea({
      name: item.name,
      city: item.city || '',
      state: item.state || '',
      pin,
    })
    setAreaPrompt(false)
    setAreaQuery('')
    setErrors({})
    window.scrollTo(0, 0)
  }

  const areaQueryText = areaQuery.trim().toLowerCase()
  const serviceAreas = serviceLocations.filter((item) => item.subscription && item.center)
  const matchingAreas = serviceAreas.filter((item) => {
    if (!areaQueryText) return true
    const pins = Array.isArray(item.pins) ? item.pins.join(' ') : ''
    return `${item.name} ${item.city} ${item.state} ${pins}`.toLowerCase().includes(areaQueryText)
  })

  return (
    <section className="section account-page address-page">
      <DocumentTitle title={address ? 'Edit address' : 'Add address'} />
      <div className="container narrow">
        <header className="account-head">
          <h1>{address ? 'Edit address' : 'Add a delivery address'}</h1>
          <p className="subs-muted">
            {chosenArea
              ? `Delivery area: ${chosenArea.name}. Enter the house address in ${[chosenArea.city, chosenArea.pin].filter(Boolean).join(', ')}, then save.`
              : 'Enter the house address first. Then set a delivery point so the store can check subscription delivery.'}
          </p>
        </header>
        <form className="address-layout" onSubmit={submit} noValidate>
          <div className="account-panel">
            {errors.form ? <div className="form-alert" role="alert">{errors.form}</div> : null}
            {chosenArea ? (
              <p className="address-callout" role="status">
                <strong>{chosenArea.name}</strong> is a subscription delivery area. Add the house number and street for this place. City, state, and PIN are already set.
              </p>
            ) : null}
            <div className="form-grid form-grid--split">
              <TextField id="line1" name="line1" className="field--wide" label="House and street" autoComplete="address-line1" required value={values.line1} error={errors.line1} onChange={update} />
              <TextField id="line2" name="line2" className="field--wide" label="Address line 2" autoComplete="address-line2" value={values.line2} onChange={update} />
              <TextField id="landmark" name="landmark" className="field--wide" label="Landmark" value={values.landmark} onChange={update} />
              <TextField id="city" name="city" label="City" autoComplete="address-level2" required value={values.city} error={errors.city} onChange={update} />
              <SelectField id="state" name="state" label="State" autoComplete="address-level1" required value={values.state} error={errors.state} onChange={update}>
                {states.map((state) => <option key={state}>{state}</option>)}
              </SelectField>
              <TextField
                id="pin"
                name="pin"
                label="PIN code"
                inputMode="numeric"
                autoComplete="postal-code"
                required
                maxLength={6}
                value={values.pin}
                error={errors.pin}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  pin: event.target.value.replace(/\D/g, '').slice(0, 6),
                }))}
              />
              <TextField id="contact-name" name="contactName" label="Contact person" autoComplete="name" required value={values.contactName} error={errors.contactName} onChange={update} />
              <TextField
                id="contact-phone"
                name="contactPhone"
                label="Contact phone"
                inputMode="numeric"
                autoComplete="tel"
                required
                maxLength={10}
                value={values.contactPhone}
                error={errors.contactPhone}
                onChange={(event) => setValues((current) => ({
                  ...current,
                  contactPhone: event.target.value.replace(/\D/g, '').slice(0, 10),
                }))}
              />
            </div>
            <fieldset className="choice-set">
              <legend>Address type</legend>
              <div className="choices choices--3">
                {types.map((type) => (
                  <label key={type.id} className="choice">
                    <input type="radio" name="type" value={type.id} checked={values.type === type.id} onChange={update} />
                    <strong>{type.title}</strong>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="address-point">
              <p className="address-point__title">Delivery point</p>
              <p className="subs-muted">Set the location with GPS, a PIN code, a place, or the map. The store uses this point to check subscription delivery.</p>
              <div className="locate-row">
                <Button variant="outline" disabled={locating} onClick={useCurrentLocation}>Use current location</Button>
                <Button variant="outline" disabled={locating} onClick={findPin}>Find PIN code</Button>
              </div>
              {locateError ? <p className="field__error" role="alert">{locateError}</p> : null}
              <div className="place-box">
                <TextField
                  id="place-search"
                  label="Search a place"
                  hint={placesAvailable === false
                    ? 'Place search needs the Google key on the server. PIN code, GPS, and the map still work.'
                    : 'Type an area, street, or landmark in India.'}
                  value={placeQuery}
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-controls="place-suggestions"
                  aria-autocomplete="list"
                  autoComplete="off"
                  onChange={(event) => {
                    const value = event.target.value
                    setPlaceQuery(value)
                    if (value.trim().length < 3) setSuggestions([])
                  }}
                />
                {suggestions.length > 0 ? (
                  <ul id="place-suggestions" className="place-list" role="listbox">
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.id} role="presentation">
                        <button type="button" role="option" onClick={() => {
                          setPlaceQuery(suggestion.label)
                          setSuggestions([])
                          placeFrom({ placeId: suggestion.id })
                        }}
                        >
                          <strong>{suggestion.label}</strong>
                          {suggestion.secondary ? <span>{suggestion.secondary}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <ServiceabilityStatus service={checked.service} checking={checking} error={checked.error} hideUnchecked />
            <div className="locate-row">
              <Button type="submit" disabled={saving || checking}>{saving ? 'Saving…' : 'Save address'}</Button>
              <Button variant="ghost" to="/addresses">Cancel</Button>
            </div>
          </div>
          <LocationMap
            latitude={values.latitude}
            longitude={values.longitude}
            onPick={(point) => placeFrom(point)}
          />
        </form>
        <Dialog
          open={Boolean(areaPrompt)}
          title={areaPrompt === 'point' ? 'Set the delivery point' : 'Outside the delivery area'}
          className="dialog--areas"
          onClose={() => setAreaPrompt(false)}
        >
          {areaPrompt === 'point' ? (
            <>
              <p className="area-prompt__copy">The address is filled in. A map point is still needed before subscription delivery can be checked.</p>
              <p className="area-prompt__copy">Set the location with GPS, a PIN code, a place, or the map.</p>
              <Button type="button" variant="outline" onClick={() => setAreaPrompt(false)}>Set it on this page</Button>
              <p className="area-prompt__label">Or choose a delivery area, then enter the house address for that place.</p>
            </>
          ) : (
            <p className="area-prompt__copy">This address is outside the subscription area. Choose a delivery area below, then enter the house address for that place.</p>
          )}
          <TextField
            id="area-search"
            label="Search delivery areas"
            value={areaQuery}
            placeholder="Area, city, or PIN"
            autoComplete="off"
            onChange={(event) => setAreaQuery(event.target.value)}
          />
          {errors.form ? <p className="field__error" role="alert">{errors.form}</p> : null}
          <ul className="area-list">
            {matchingAreas.map((item) => (
              <li key={item.id}>
                <button type="button" disabled={saving} onClick={() => chooseArea(item)}>
                  <strong>{item.name}</strong>
                  <span>{[item.city, item.state, ...(item.pins || [])].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
            {matchingAreas.length === 0 ? <li className="area-list__empty">No matching delivery area.</li> : null}
          </ul>
        </Dialog>
      </div>
    </section>
  )
}
