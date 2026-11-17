import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { AuthError, resendVerification } from '../api/authApi.js'
import AccountSectionNav from '../components/AccountSectionNav.jsx'
import AddressBook from '../components/AddressBook.jsx'
import SupportConversationList from '../components/SupportConversationList.jsx'
import { ContactError, loadMyContactQueries } from '../api/contactApi.js'
import { useShop } from '../context/shopContext.js'

export default function AccountPage() {
  const { account, authReady, updateProfile, logout } = useShop()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab = tabParam === 'addresses' ? 'addresses' : tabParam === 'support' ? 'support' : 'profile'
  const returnFrom = `${location.pathname}${location.search}`
  const showToast = useToast()
  const [profile, setProfile] = useState(null)
  const [profileErrors, setProfileErrors] = useState({})
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [supportQueries, setSupportQueries] = useState([])
  const [supportError, setSupportError] = useState('')
  const [supportBusy, setSupportBusy] = useState(false)

  const draft = profile || { name: account?.name || '', phone: account?.phone || '' }

  function setTab(next) {
    if (next === 'profile') {
      setParams({}, { replace: true })
      return
    }
    setParams({ tab: next }, { replace: true })
  }

  const loadSupport = useCallback(() => {
    if (!account) return Promise.resolve()
    setSupportError('')
    setSupportBusy(true)
    return loadMyContactQueries()
      .then(setSupportQueries)
      .catch((reason) => setSupportError(reason instanceof ContactError ? reason.message : 'Support messages could not be loaded.'))
      .finally(() => setSupportBusy(false))
  }, [account])

  useEffect(() => {
    if (tab === 'support' && account) loadSupport()
  }, [tab, account, loadSupport])

  function onSupportUpdated(next) {
    setSupportQueries((current) => current.map((row) => (row.id === next.id ? next : row)))
  }

  if (authReady && !account && tab !== 'addresses' && tab !== 'support') {
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
      <DocumentTitle title={tab === 'addresses' ? 'Saved addresses' : tab === 'support' ? 'Support' : 'Account'} />
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
            <div className="account-profile-card panel" aria-label="Account summary">
              <strong>{account.name}</strong>
              <span className="subs-muted">{account.email}</span>
              {account.phone ? <span className="subs-muted">{account.phone}</span> : null}
            </div>
            <form className="form-grid account-form" onSubmit={saveProfile} noValidate>
              <h2 className="account-panel__title">Edit profile</h2>
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

        {authReady && !account && tab === 'support' ? (
          <section id="account-panel-support" role="tabpanel" aria-labelledby="account-tab-support" className="account-tab-panel">
            <div className="panel auth-card">
              <h2 className="account-panel__title">Sign in for support</h2>
              <p className="subs-muted">Your contact queries and replies from Rudra&apos;s Farm Fresh appear here.</p>
              <Button to="/login" state={{ from: '/account?tab=support' }}>Sign in</Button>
            </div>
          </section>
        ) : null}

        {authReady && account && tab === 'support' ? (
          <section
            id="account-panel-support"
            role="tabpanel"
            aria-labelledby="account-tab-support"
            className="account-tab-panel"
          >
            <h2 className="account-panel__title">Support conversations</h2>
            <p className="subs-muted">Queries you raised on the <Link to="/support/contact">Contact</Link> page.</p>
            {supportError ? <p className="field__error" role="alert">{supportError}</p> : null}
            {supportBusy ? <p className="subs-muted" role="status">Loading…</p> : null}
            {!supportBusy && supportQueries.length === 0 ? (
              <p className="subs-muted">No messages yet. <Link to="/support/contact">Contact us</Link> if you need help.</p>
            ) : null}
            {supportQueries.length > 0 ? (
              <SupportConversationList queries={supportQueries} allowReply onUpdated={onSupportUpdated} />
            ) : null}
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
