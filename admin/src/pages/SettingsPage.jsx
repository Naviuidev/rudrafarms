import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { fetchSettings, saveStoreProfile, SettingsError } from '../api/settingsApi.js'
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
  const [storeBusy, setStoreBusy] = useState(false)
  const [storeError, setStoreError] = useState('')

  useEffect(() => {
    let cancel = false
    fetchSettings()
      .then((next) => {
        if (cancel || !next) return
        if (next.store?.storeName) {
          setValues({
            storeName: next.store.storeName,
            supportEmail: next.store.supportEmail || '',
            minimum: next.store.freeDeliveryMinimum || '',
          })
        }
      })
      .catch((error) => {
        if (!cancel) setStoreError(error instanceof SettingsError ? error.message : 'Settings could not be loaded.')
      })
    return () => {
      cancel = true
    }
  }, [])

  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
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

  if (params.get('section') === 'hours') {
    return <Navigate to="/settings?section=store" replace />
  }

  return (
    <>
      <DocumentTitle title="Settings" />
      {section === 'store' ? (
        <>
          <div className="page-heading">
            <p className="eyebrow">Store</p>
            <h1>Store name</h1>
            <p>The name customers see, plus the support address for this shop. Use the top bar switch to open or close website checkout.</p>
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
