import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { SelectField, TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { checkServiceability, resolveLocation } from '../api/locationApi.js'
import LocationMap from '../components/LocationMap.jsx'
import ServiceabilityStatus from '../components/ServiceabilityStatus.jsx'
import { addressPurpose } from '../addressPurpose.js'
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

function blankForm(contact = {}) {
  return {
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: 'Andhra Pradesh',
    pin: '',
    latitude: null,
    longitude: null,
    type: 'home',
    contactName: contact.name || '',
    contactPhone: contact.phone || '',
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
  const deliveryPurpose = addressPurpose(location.state?.from, location.state?.purpose)
  const subscriptionFlow = deliveryPurpose === 'subscription'
  const checkPurpose = subscriptionFlow ? 'subscription' : 'checkout'
  const { saveAddress, serviceLocations, account } = useShop()
  const showToast = useToast()
  const contactSeed = {
    name: account?.name || '',
    phone: account?.phone || '',
  }
  const [values, setValues] = useState(() => (address ? formFrom(address) : blankForm(contactSeed)))
  const [errors, setErrors] = useState({})
  const [checked, setChecked] = useState({ pointKey: '', service: null, error: '' })
  const [locateError, setLocateError] = useState('')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [areaPrompt, setAreaPrompt] = useState(false)
  const resolvedPinRef = useRef('')

  const latitude = values.latitude
  const longitude = values.longitude
  const pointKey = latitude == null || longitude == null ? '' : `${latitude},${longitude}`
  const checking = pointKey !== '' && checked.pointKey !== pointKey
  const hasPoint = pointKey !== ''
  const subscriptionAreas = serviceLocations.filter((item) => item.subscription && item.center)

  useEffect(() => {
    if (address) return
    if (values.contactName && values.contactPhone) return
    setValues((current) => ({
      ...current,
      contactName: current.contactName || contactSeed.name,
      contactPhone: current.contactPhone || contactSeed.phone,
    }))
  }, [address, contactSeed.name, contactSeed.phone, values.contactName, values.contactPhone])

  useEffect(() => {
    if (!/^[1-9][0-9]{5}$/.test(values.pin)) return undefined
    if (resolvedPinRef.current === values.pin && hasPoint) return undefined
    let cancel = false
    const timer = setTimeout(() => {
      if (cancel) return
      placeFrom({ pin: values.pin }, true)
    }, 500)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [values.pin, hasPoint])

  useEffect(() => {
    if (!pointKey) return undefined
    let cancel = false
    checkServiceability({ latitude, longitude, pin: values.pin }, checkPurpose).then((service) => {
      if (!cancel) setChecked({ pointKey, service, error: '' })
    }).catch((reason) => {
      if (!cancel) {
        setChecked({
          pointKey,
          service: null,
          error: reason instanceof Error ? reason.message : 'Could not check this location.',
        })
      }
    })
    return () => {
      cancel = true
    }
  }, [pointKey, latitude, longitude, checkPurpose, values.pin])

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
  }

  async function placeFrom(payload, quiet = false) {
    if (!quiet) setLocating(true)
    setLocateError('')
    try {
      const resolved = await resolveLocation(payload)
      if (!resolved?.found) {
        if (!quiet) setLocateError(resolved?.message || 'Could not place this location.')
        return
      }
      applyResolved(resolved)
      if (payload.pin) resolvedPinRef.current = String(payload.pin)
    } catch (reason) {
      if (!quiet) {
        setLocateError(reason instanceof Error ? reason.message : 'Could not place this location.')
      }
    } finally {
      if (!quiet) setLocating(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError('Allow location in the browser, or enter a PIN code.')
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

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (values.line1.trim().length < 5) next.line1 = 'Enter house number and street.'
    if (values.city.trim().length < 2) next.city = 'Enter city.'
    if (!values.state) next.state = 'Choose state.'
    if (!/^[1-9][0-9]{5}$/.test(values.pin)) next.pin = 'Enter a 6-digit PIN.'
    if (values.contactName.trim().length < 2) next.contactName = 'Enter name.'
    if (!/^[6-9]\d{9}$/.test(values.contactPhone)) next.contactPhone = 'Enter a 10-digit mobile.'
    setErrors(next)
    if (Object.keys(next).length) return
    if (!hasPoint) {
      setLocateError('Tap “Use my location”, enter PIN, or drop a pin on the map.')
      return
    }

    setSaving(true)
    try {
      const service = checked.service?.purpose === checkPurpose
        ? checked.service
        : await checkServiceability({
          latitude: values.latitude,
          longitude: values.longitude,
          pin: values.pin,
        }, checkPurpose)

      if (!service.allowed) {
        setLocateError(service.message || 'We deliver only in Visakhapatnam (Vizag).')
        if (subscriptionFlow) setAreaPrompt(true)
        return
      }

      await saveAddress({ ...values, id: address?.id })
      showToast({
        title: 'Address saved',
        message: subscriptionFlow ? 'Ready for subscription delivery.' : 'Ready for delivery.',
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
      navigate(subscriptionFlow ? '/subscriptions' : '/addresses', { replace: true })
    } catch (reason) {
      setErrors({ form: reason instanceof Error ? reason.message : 'Could not save.' })
    } finally {
      setSaving(false)
    }
  }

  function pickSubscriptionArea(item) {
    const pin = Array.isArray(item.pins) ? String(item.pins[0] || '') : ''
    setValues((current) => ({
      ...current,
      city: item.city || current.city,
      state: item.state || current.state,
      pin: pin || current.pin,
      latitude: item.center.latitude,
      longitude: item.center.longitude,
    }))
    resolvedPinRef.current = pin
    setLocateError('')
    setErrors({})
  }

  return (
    <section className="section account-page address-page address-page--simple">
      <DocumentTitle title={address ? 'Edit address' : 'Add address'} />
      <div className="container address-page__container">
        <header className="account-head account-head--tight">
          <h1>{address ? 'Edit address' : 'Add address'}</h1>
        </header>

        <form className="address-form" onSubmit={submit} noValidate>
          <div className="address-form__split">
          <section className="address-form__fields" aria-label="Address details">
          {errors.form ? <div className="form-alert" role="alert">{errors.form}</div> : null}

          <TextField
            id="line1"
            name="line1"
            label="House / street"
            autoComplete="address-line1"
            required
            value={values.line1}
            error={errors.line1}
            onChange={update}
          />

          <div className="form-grid form-grid--pair">
            <TextField id="city" name="city" label="City" autoComplete="address-level2" required value={values.city} error={errors.city} onChange={update} />
            <TextField
              id="pin"
              name="pin"
              label="PIN"
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
          </div>

          <SelectField id="state" name="state" label="State" autoComplete="address-level1" required value={values.state} error={errors.state} onChange={update}>
            {states.map((state) => <option key={state}>{state}</option>)}
          </SelectField>

          <div className="form-grid form-grid--pair">
            <TextField id="contact-name" name="contactName" label="Name" autoComplete="name" required value={values.contactName} error={errors.contactName} onChange={update} />
            <TextField
              id="contact-phone"
              name="contactPhone"
              label="Mobile"
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

          <details className="address-form__more">
            <summary>More (optional)</summary>
            <div className="address-form__more-body">
              <TextField id="line2" name="line2" label="Apartment / floor" autoComplete="address-line2" value={values.line2} onChange={update} />
              <TextField id="landmark" name="landmark" label="Landmark" value={values.landmark} onChange={update} />
              <fieldset className="choice-set choice-set--inline">
                <legend>Type</legend>
                <div className="choices choices--3">
                  {types.map((type) => (
                    <label key={type.id} className="choice">
                      <input type="radio" name="type" value={type.id} checked={values.type === type.id} onChange={update} />
                      <strong>{type.title}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          <Button type="submit" className="sub-cta address-form__save" disabled={saving || checking}>
            {saving ? 'Saving…' : 'Save address'}
          </Button>
          </section>

          <section className="address-form__map" aria-label="Location">
            <LocationMap
              compact
              latitude={values.latitude}
              longitude={values.longitude}
              onPick={(point) => placeFrom(point)}
            />
            <div className="address-form__locate-row">
              <Button type="button" variant="outline" disabled={locating} onClick={useCurrentLocation}>
                {locating ? 'Finding…' : 'Use my location'}
              </Button>
              <ServiceabilityStatus
                compact
                service={checked.service}
                checking={checking}
                error={checked.error}
                hideUnchecked
                mode={subscriptionFlow ? 'subscription' : 'quick'}
              />
            </div>
            {locateError ? <p className="field__error" role="alert">{locateError}</p> : null}
            {subscriptionFlow && subscriptionAreas.length > 0 ? (
              <div className="address-form__zones">
                {subscriptionAreas.slice(0, 6).map((item) => (
                  <button key={item.id} type="button" className="address-zone-chip" onClick={() => pickSubscriptionArea(item)}>
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          </div>
        </form>

        <Dialog
          open={areaPrompt}
          title="Outside subscription area"
          className="dialog--areas"
          onClose={() => setAreaPrompt(false)}
        >
          <p className="area-prompt__copy">
            This location is not in a subscription zone. Pick an area below or move the map pin inside a zone.
          </p>
          <ul className="area-list">
            {subscriptionAreas.map((item) => (
              <li key={item.id}>
                <button type="button" disabled={saving} onClick={() => { pickSubscriptionArea(item); setAreaPrompt(false) }}>
                  <strong>{item.name}</strong>
                  <span>{[item.city, item.state, ...(item.pins || [])].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
            {subscriptionAreas.length === 0 ? (
              <li className="area-list__empty">The store has not added subscription zones yet.</li>
            ) : null}
          </ul>
        </Dialog>
      </div>
    </section>
  )
}
