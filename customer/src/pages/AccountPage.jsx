import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { AuthError, resendVerification } from '../api/authApi.js'
import { useShop } from '../context/shopContext.js'

export default function AccountPage() {
  const { account, authReady, updateProfile, logout } = useShop()
  const navigate = useNavigate()
  const location = useLocation()
  const returnFrom = `${location.pathname}${location.search}`
  const showToast = useToast()
  const [profile, setProfile] = useState(null)
  const [profileErrors, setProfileErrors] = useState({})
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState('')

  const draft = profile || { name: account?.name || '', phone: account?.phone || '' }

  if (authReady && !account) {
    return (
      <section className="section">
        <DocumentTitle title="Account" />
        <div className="container narrow">
          <div className="panel auth-card">
            <h1>Sign in to see your account</h1>
            <Button to="/login" state={{ from: returnFrom }}>Sign in</Button>
            <p>New here? <Link to="/register" state={{ from: returnFrom }}>Create an account</Link></p>
          </div>
        </div>
      </section>
    )
  }

  async function saveProfile(event) {
    event.preventDefault()
    setBusy('profile')
    setProfileErrors({})
    try {
      await updateProfile({ name: draft.name, phone: draft.phone })
      showToast({ title: 'Profile saved', message: 'Your name and mobile number are updated.' })
    } catch (reason) {
      if (reason instanceof AuthError) setProfileErrors(reason.fields)
      setProfileErrors((current) => ({ ...current, form: reason instanceof Error ? reason.message : 'The profile could not be saved.' }))
    } finally {
      setBusy('')
    }
  }

  async function resend() {
    setBusy('verify')
    try {
      const result = await resendVerification(account.email)
      setPreviewUrl(result.previewUrl || '')
      showToast({ title: 'Verification link', message: result.previewUrl ? 'A local preview link is shown below.' : 'Check your inbox.' })
    } catch (reason) {
      setProfileErrors({ form: reason instanceof Error ? reason.message : 'A new link could not be sent.' })
    } finally {
      setBusy('')
    }
  }

  async function signOut() {
    await logout()
    navigate('/')
  }

  return (
    <section className="section">
      <DocumentTitle title="Account" />
      <div className="container narrow">
        <div className="page-intro">
          <p className="eyebrow">Account</p>
          <h1>{account ? account.name : 'Account'}</h1>
          <p>{account ? account.email : 'Loading your account…'}</p>
        </div>
        {account ? (
          <div className="panel auth-card">
            {profileErrors.form ? <div className="form-alert" role="alert">{profileErrors.form}</div> : null}
            <p className={account.emailVerified ? 'success-banner' : 'auth-note'} role="status">
              {account.emailVerified ? 'Email verified.' : 'Email verification is still pending.'}
            </p>
            {!account.emailVerified ? <Button variant="outline" disabled={busy === 'verify'} onClick={resend}>Send verification link</Button> : null}
            {previewUrl ? <p className="auth-note">Verification link: <a href={previewUrl}>{previewUrl}</a></p> : null}
            <form className="form-grid" onSubmit={saveProfile} noValidate>
              <h2>Profile</h2>
              <TextField id="account-name" label="Name" autoComplete="name" required value={draft.name} error={profileErrors.name} onChange={(event) => setProfile({ ...draft, name: event.target.value })} />
              <TextField id="account-phone" label="Mobile" inputMode="numeric" autoComplete="tel" hint="Optional." value={draft.phone} error={profileErrors.phone} onChange={(event) => setProfile({ ...draft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} />
              <Button type="submit" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</Button>
            </form>
            <p className="auth-links">
              <Link to="/orders">Orders</Link>
              <Link to="/account/settings">Settings</Link>
              <Link to="/addresses">Saved addresses</Link>
              <button type="button" className="text-button" onClick={signOut}>Log out</button>
            </p>
          </div>
        ) : <p role="status">Loading your account…</p>}
      </div>
    </section>
  )
}
