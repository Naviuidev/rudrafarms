import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { useToast } from '@brand/toastContext.js'
import { AuthError } from '../api/authApi.js'
import PasswordField from '../components/PasswordField.jsx'
import { useShop } from '../context/shopContext.js'

export default function SettingsPage() {
  const { account, authReady, changePassword } = useShop()
  const location = useLocation()
  const returnFrom = `${location.pathname}${location.search}`
  const showToast = useToast()
  const [passwords, setPasswords] = useState({ currentPassword: '', password: '', confirm: '' })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [busy, setBusy] = useState(false)

  if (authReady && !account) {
    return (
      <section className="section account-page">
        <DocumentTitle title="Settings" />
        <div className="container narrow">
          <header className="account-head">
            <h1>Settings</h1>
            <p className="subs-muted">Sign in to change your password.</p>
          </header>
          <div className="account-panel account-panel--center">
            <h2 className="account-panel__title">Sign in required</h2>
            <p className="subs-muted">Change your password after you sign in.</p>
            <Button className="sub-cta" to="/login" state={{ from: returnFrom }}>Sign in</Button>
          </div>
        </div>
      </section>
    )
  }

  async function savePassword(event) {
    event.preventDefault()
    const next = {}
    if (passwords.currentPassword.length < 1) next.currentPassword = 'Enter your current password.'
    if (passwords.password.length < 8) next.password = 'Use at least 8 characters.'
    if (passwords.confirm !== passwords.password) next.confirm = 'Passwords do not match.'
    setPasswordErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await changePassword(passwords.currentPassword, passwords.password)
      setPasswords({ currentPassword: '', password: '', confirm: '' })
      showToast({ title: 'Password updated', message: 'Use the new password the next time you sign in.' })
    } catch (reason) {
      if (reason instanceof AuthError) setPasswordErrors(reason.fields)
      setPasswordErrors((current) => ({
        ...current,
        form: reason instanceof Error ? reason.message : 'The password could not be changed.',
      }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section account-page">
      <DocumentTitle title="Settings" />
      <div className="container narrow">
        <header className="account-head">
          <h1>Settings</h1>
          <p className="subs-muted">{account?.email}</p>
        </header>
        <div className="account-panel">
          <form className="form-grid account-form" onSubmit={savePassword} noValidate>
            <p className="subs-label">Security</p>
            <h2 className="account-panel__title">Password</h2>
            <p className="subs-muted account-form__hint">Choose a new password. You stay signed in on this device.</p>
            {passwordErrors.form ? <div className="form-alert" role="alert">{passwordErrors.form}</div> : null}
            <PasswordField
              id="settings-current"
              label="Current password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              error={passwordErrors.currentPassword}
              onChange={(value) => setPasswords({ ...passwords, currentPassword: value })}
            />
            <PasswordField
              id="settings-new"
              label="New password"
              autoComplete="new-password"
              value={passwords.password}
              error={passwordErrors.password}
              onChange={(value) => setPasswords({ ...passwords, password: value })}
            />
            <PasswordField
              id="settings-confirm"
              label="Confirm new password"
              autoComplete="new-password"
              value={passwords.confirm}
              error={passwordErrors.confirm}
              onChange={(value) => setPasswords({ ...passwords, confirm: value })}
            />
            <Button className="sub-cta" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button>
          </form>
        </div>
        <nav className="account-nav" aria-label="Account">
          <Link to="/account">Profile</Link>
          <Link to="/orders">Orders</Link>
        </nav>
      </div>
    </section>
  )
}
