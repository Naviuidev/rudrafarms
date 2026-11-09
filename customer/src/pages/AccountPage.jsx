import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { AuthError, resendVerification } from '../api/authApi.js'
import AccountSectionNav from '../components/AccountSectionNav.jsx'
import AddressBook from '../components/AddressBook.jsx'
import { useShop } from '../context/shopContext.js'

export default function AccountPage() {
  const { account, authReady, updateProfile, logout } = useShop()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'addresses' ? 'addresses' : 'profile'
  const returnFrom = `${location.pathname}${location.search}`
  const showToast = useToast()
  const [profile, setProfile] = useState(null)
  const [profileErrors, setProfileErrors] = useState({})
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState('')

  const draft = profile || { name: account?.name || '', phone: account?.phone || '' }

  function setTab(next) {
    if (next === 'profile') {
      setParams({}, { replace: true })
      return
    }
    setParams({ tab: next }, { replace: true })
  }

  if (authReady && !account && tab !== 'addresses') {
    return (
      <section className="section account-page">
        <DocumentTitle title="Account" />
        <div className="container narrow">
          <header className="account-head">
            <h1>Account</h1>
          </header>
          <AccountSectionNav active={tab} onSelect={setTab} />
          <div className="panel auth-card">
            <h2 className="account-panel__title">Sign in for profile</h2>
            <p className="subs-muted">Saved addresses on this device work without signing in.</p>
            <Button to="/login" state={{ from: returnFrom }}>Sign in</Button>
            <p className="subs-muted">New here? <Link to="/register" state={{ from: returnFrom }}>Create an account</Link></p>
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
    <section className="section account-page">
      <DocumentTitle title={tab === 'addresses' ? 'Saved addresses' : 'Account'} />
      <div className="container narrow">
        <header className="account-head">
          <h1>Account</h1>
          <p className="subs-muted">{account ? account.email : 'Loading your account…'}</p>
        </header>

        <AccountSectionNav active={tab} onSelect={setTab} />

        {!authReady ? (
          <p className="subs-muted" role="status">Loading your account…</p>
        ) : null}

        {authReady && account && tab === 'profile' ? (
          <section
            id="account-panel-profile"
            role="tabpanel"
            aria-labelledby="account-tab-profile"
            className="account-panel account-tab-panel"
          >
            {profileErrors.form ? <div className="form-alert" role="alert">{profileErrors.form}</div> : null}
            <p className={account.emailVerified ? 'success-banner' : 'auth-note'} role="status">
              {account.emailVerified ? 'Email verified.' : 'Email verification is still pending.'}
            </p>
            {!account.emailVerified ? (
              <Button variant="outline" disabled={busy === 'verify'} onClick={resend}>Send verification link</Button>
            ) : null}
            {previewUrl ? (
              <p className="auth-note">Verification link: <a href={previewUrl}>{previewUrl}</a></p>
            ) : null}
            <form className="form-grid account-form" onSubmit={saveProfile} noValidate>
              <h2 className="account-panel__title">Profile</h2>
              <TextField
                id="account-name"
                label="Name"
                autoComplete="name"
                required
                value={draft.name}
                error={profileErrors.name}
                onChange={(event) => setProfile({ ...draft, name: event.target.value })}
              />
              <TextField
                id="account-phone"
                label="Mobile"
                inputMode="numeric"
                autoComplete="tel"
                hint="Optional."
                value={draft.phone}
                error={profileErrors.phone}
                onChange={(event) => setProfile({ ...draft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
              <Button className="sub-cta" type="submit" disabled={busy === 'profile'}>
                {busy === 'profile' ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
            <nav className="account-links" aria-label="More account links">
              <Link to="/orders">Orders</Link>
              <Link to="/account/settings">Settings</Link>
              <button type="button" className="text-button" onClick={signOut}>Log out</button>
            </nav>
          </section>
        ) : null}

        {authReady && tab === 'addresses' ? (
          <section
            id="account-panel-addresses"
            role="tabpanel"
            aria-labelledby="account-tab-addresses"
            className="account-tab-panel"
          >
            {!account ? (
              <p className="subs-muted address-book__hint">Sign in to sync addresses across devices.</p>
            ) : null}
            <AddressBook deliverySelect />
          </section>
        ) : null}
      </div>
    </section>
  )
}
