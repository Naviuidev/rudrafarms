import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { fetchSettings, saveStoreHours, saveStoreProfile, SettingsError } from '../api/settingsApi.js'
import { settingsSection } from '../settings/sections.js'

const storageKey = 'rff-admin-settings'

function storedSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '')
    if (!parsed || typeof parsed !== 'object') return null
    return {
      storeName: typeof parsed.storeName === 'string' ? parsed.storeName : 'RudrasFarmFresh',
      supportEmail: typeof parsed.supportEmail === 'string' ? parsed.supportEmail : '',
      minimum: typeof parsed.minimum === 'string' ? parsed.minimum : '',
    }
  } catch {
    return null
  }
}

export default function SettingsPage() {
  const showToast = useToast()
  const [params] = useSearchParams()
  const section = settingsSection(params.get('section'))
  const [values, setValues] = useState(() => storedSettings() || {
    storeName: 'RudrasFarmFresh',
    supportEmail: '',
    minimum: '',
  })
  const [errors, setErrors] = useState({})
  const [hours, setHours] = useState({ open: '06:00', close: '20:00' })
  const [hourErrors, setHourErrors] = useState({})
  const [hoursError, setHoursError] = useState('')
  const [hoursBusy, setHoursBusy] = useState(false)
  const [storeBusy, setStoreBusy] = useState(false)
  const [storeError, setStoreError] = useState('')

  useEffect(() => {
    let cancel = false
    fetchSettings()
      .then((next) => {
        if (cancel || !next) return
        if (next.hours) setHours({ open: next.hours.open || '06:00', close: next.hours.close || '20:00' })
        if (next.store?.storeName) {
          setValues({
            storeName: next.store.storeName,
            supportEmail: next.store.supportEmail || '',
            minimum: next.store.freeDeliveryMinimum || '',
          })
        }
      })
      .catch((error) => {
        if (!cancel) setHoursError(error instanceof SettingsError ? error.message : 'Settings could not be loaded.')
      })
    return () => {
      cancel = true
    }
  }, [])

  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  function updateHours(event) {
    const { name, value } = event.target
    setHours((current) => ({ ...current, [name]: value }))
  }

  async function saveHours(event) {
    event.preventDefault()
    const next = {}
    if (!hours.open) next.open = 'Choose an open time.'
    if (!hours.close) next.close = 'Choose a close time.'
    if (hours.open && hours.close && hours.open >= hours.close) {
      next.close = 'Close time has to be later than open time.'
    }
    setHourErrors(next)
    if (Object.keys(next).length) return
    setHoursBusy(true)
    setHoursError('')
    try {
      const saved = await saveStoreHours(hours.open, hours.close)
      if (saved) setHours({ open: saved.open, close: saved.close })
      showToast({ title: 'Store hours saved', message: `One-time orders are accepted ${saved?.open || hours.open}–${saved?.close || hours.close} IST.` })
    } catch (error) {
      setHoursError(error instanceof SettingsError ? error.message : 'Store hours could not be saved.')
    } finally {
      setHoursBusy(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (values.storeName.trim().length < 3) next.storeName = 'Enter the store name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supportEmail)) next.supportEmail = 'Enter a valid support email.'
    if (values.minimum !== '' && !/^\d+$/.test(values.minimum)) {
      next.minimum = 'Enter a whole amount in rupees.'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    setStoreBusy(true)
    setStoreError('')
    try {
      const saved = await saveStoreProfile(values.storeName.trim(), values.supportEmail.trim(), values.minimum.trim())
      if (saved) {
        const nextValues = {
          storeName: saved.storeName,
          supportEmail: saved.supportEmail,
          minimum: saved.freeDeliveryMinimum,
        }
        setValues(nextValues)
        localStorage.setItem(storageKey, JSON.stringify(nextValues))
      }
      showToast({ title: 'Store name saved', message: 'The store name is saved for this shop.' })
    } catch (error) {
      setStoreError(error instanceof SettingsError ? error.message : 'Store name could not be saved.')
    } finally {
      setStoreBusy(false)
    }
  }

  if (params.get('section') === 'email') {
    return <Navigate to="/developer?section=email" replace />
  }

  return (
    <>
      <DocumentTitle title="Settings" />
      {section === 'hours' ? (
        <>
          <div className="page-heading">
            <p className="eyebrow">Store</p>
            <h1>Store hours</h1>
            <p>One-time orders can be placed while the shop is open. Subscriptions can still be placed any time.</p>
          </div>
          <form className="panel settings-form" onSubmit={saveHours} noValidate>
            {hoursError ? <p className="field__error" role="alert">{hoursError}</p> : null}
            <TextField id="store-open" name="open" type="time" label="Opens" required value={hours.open} error={hourErrors.open} onChange={updateHours} />
            <TextField id="store-close" name="close" type="time" label="Closes" required value={hours.close} error={hourErrors.close} onChange={updateHours} />
            <Button type="submit" disabled={hoursBusy}>{hoursBusy ? 'Saving…' : 'Save hours'}</Button>
          </form>
        </>
      ) : null}
      {section === 'store' ? (
        <>
          <div className="page-heading">
            <p className="eyebrow">Store</p>
            <h1>Store name</h1>
            <p>The name customers see, plus the support address for this shop.</p>
          </div>
          <form className="panel settings-form" onSubmit={submit} noValidate>
            {storeError ? <p className="field__error" role="alert">{storeError}</p> : null}
            <TextField id="store-name" name="storeName" label="Store name" required value={values.storeName} error={errors.storeName} onChange={update} />
            <TextField id="support-email" name="supportEmail" type="email" label="Support email" required value={values.supportEmail} error={errors.supportEmail} onChange={update} />
            <TextField
              id="free-delivery"
              name="minimum"
              label="Free-delivery minimum"
              hint="Leave blank until a service zone sets the threshold. Amount in rupees."
              inputMode="numeric"
              value={values.minimum}
              error={errors.minimum}
              onChange={update}
            />
            <Button type="submit" disabled={storeBusy}>{storeBusy ? 'Saving…' : 'Save store name'}</Button>
          </form>
        </>
      ) : null}
    </>
  )
}
