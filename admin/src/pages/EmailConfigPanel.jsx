import { useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { openMailSettings, saveMailSettings, SettingsError } from '../api/settingsApi.js'

export default function EmailConfigPanel({ password }) {
  const showToast = useToast()
  const [mail, setMail] = useState({ email: '', appPassword: '', fromName: 'RudrasFarmFresh', configured: false })
  const [mailErrors, setMailErrors] = useState({})
  const [mailError, setMailError] = useState('')
  const [mailBusy, setMailBusy] = useState(false)
  const [storeName, setStoreName] = useState('RudrasFarmFresh')

  useEffect(() => {
    let cancel = false
    openMailSettings(password)
      .then((next) => {
        if (cancel || !next?.mail) return
        if (next.store?.storeName) setStoreName(next.store.storeName)
        setMail({
          email: next.mail.email || '',
          fromName: next.mail.fromName || next.store?.storeName || 'RudrasFarmFresh',
          configured: Boolean(next.mail.configured),
          appPassword: '',
        })
      })
      .catch((error) => {
        if (!cancel) setMailError(error instanceof SettingsError ? error.message : 'Email config could not be loaded.')
      })
    return () => {
      cancel = true
    }
  }, [password])

  function updateMail(event) {
    const { name, value } = event.target
    setMail((current) => ({ ...current, [name]: value }))
  }

  async function submitMail(event) {
    event.preventDefault()
    const next = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.email.trim())) next.email = 'Enter the Gmail address.'
    const passwordValue = mail.appPassword.replace(/\s+/g, '')
    if (!mail.configured && passwordValue.length < 8) next.appPassword = 'Enter the Gmail app password.'
    setMailErrors(next)
    if (Object.keys(next).length) return
    setMailBusy(true)
    setMailError('')
    try {
      const saved = await saveMailSettings(mail.email.trim(), passwordValue, mail.fromName.trim() || storeName, password)
      setMail((current) => ({
        ...current,
        email: saved?.email || current.email,
        fromName: saved?.fromName || current.fromName,
        configured: Boolean(saved?.configured),
        appPassword: '',
      }))
      showToast({
        title: 'Email config saved',
        message: 'Gmail will send sign-in codes and other shop mail from this address.',
      })
    } catch (error) {
      setMailError(error instanceof SettingsError ? error.message : 'Email config could not be saved.')
    } finally {
      setMailBusy(false)
    }
  }

  return (
    <>
      <DocumentTitle title="Email config" />
      <div className="page-heading">
        <p className="eyebrow">Mail</p>
        <h1>Email config</h1>
        <p>Gmail sends the sign-in code and other shop mail. Use the Gmail address and its app password. Once this is saved, the code is emailed on this computer too.</p>
      </div>
      <form className="panel settings-form developer-sheet" onSubmit={submitMail} noValidate>
        {mailError ? <p className="field__error" role="alert">{mailError}</p> : null}
        <p className="muted">SMTP server smtp.gmail.com, port 587.</p>
        {mail.configured ? <p className="muted">An app password is already saved. Leave the password blank to keep it.</p> : null}
        <TextField id="smtp-email" name="email" type="email" label="Gmail address" required autoComplete="off" value={mail.email} error={mailErrors.email} onChange={updateMail} />
        <TextField
          id="smtp-password"
          name="appPassword"
          type="password"
          label="App password"
          hint="Create this in the Google account under App passwords. It is stored for sending and is not shown again."
          autoComplete="new-password"
          required={!mail.configured}
          value={mail.appPassword}
          error={mailErrors.appPassword}
          onChange={updateMail}
        />
        <TextField id="smtp-from" name="fromName" label="From name" value={mail.fromName} onChange={updateMail} />
        <Button type="submit" disabled={mailBusy}>{mailBusy ? 'Saving…' : 'Save email config'}</Button>
      </form>
    </>
  )
}
