import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { AuthError, loadAuthConfig, resendVerification } from '../api/authApi.js'
import AuthSplit from '../components/AuthSplit.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { safeReturnPath } from '../lib/authPaths.js'
import { useShop } from '../context/shopContext.js'

export default function LoginPage() {
  const { account, login, confirmOtp, logout } = useShop()
  const navigate = useNavigate()
  const location = useLocation()
  const notice = typeof location.state?.notice === 'string' ? location.state.notice : ''
  const returnTo = safeReturnPath(location.state?.from)
  const showToast = useToast()
  const [email, setEmail] = useState(account?.email || (typeof location.state?.email === 'string' ? location.state.email : ''))
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState(() => (
    typeof location.state?.challengeId === 'string' ? location.state.challengeId : ''
  ))
  const [previewCode, setPreviewCode] = useState(() => (
    typeof location.state?.previewCode === 'string' ? location.state.previewCode : ''
  ))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [unverified, setUnverified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [otpEnabled, setOtpEnabled] = useState(false)

  useEffect(() => {
    let cancel = false
    loadAuthConfig().then((config) => {
      if (!cancel) setOtpEnabled(Boolean(config?.otp))
    }).catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    setErrors(next)
    setFormError('')
    setUnverified(false)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const result = await login(email, password)
      if (result?.otpRequired) {
        setChallengeId(result.challengeId)
        setPreviewCode(result.previewCode || '')
        showToast({ title: 'Code sent', message: 'Enter the 6-digit code to finish signing in.' })
        return
      }
      setPassword('')
      showToast({ title: 'Signed in', message: 'Welcome back.' })
      navigate(returnTo)
    } catch (reason) {
      if (reason instanceof AuthError && reason.code === 'email_unverified') setUnverified(true)
      setFormError(reason instanceof Error ? reason.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: 'Enter the 6-digit code.' })
      return
    }
    setBusy(true)
    setFormError('')
    try {
      await confirmOtp(challengeId, code)
      showToast({ title: 'Signed in', message: 'Welcome back.' })
      navigate(returnTo)
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'That code could not be checked.')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    try {
      const result = await resendVerification(email)
      setFormError('')
      showToast({ title: 'Verification link', message: result.previewUrl ? 'A local preview link is shown below.' : 'Check your inbox for a new link.' })
      if (result.previewUrl) setPreviewCode('')
      if (result.previewUrl) setErrors({ preview: result.previewUrl })
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'A new link could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthSplit title="Sign in">
      {account ? (
        <div className="signup__form">
          <h2>You are signed in</h2>
          <p className="success-banner" role="status">Signed in as {account.email}</p>
          <Button to="/account">Open your account</Button>
          <Button variant="ghost" onClick={logout}>Log out</Button>
        </div>
      ) : (
        <>
          {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
          {errors.preview ? <p className="auth-note">Verification link: <a href={errors.preview}>{errors.preview}</a></p> : null}
          {challengeId ? (
            <form className="signup__form" onSubmit={submitCode} noValidate>
              <h2>Enter the code</h2>
              <p>Enter the 6-digit code to finish signing in.</p>
              <TextField id="login-code" label="Sign-in code" inputMode="numeric" autoComplete="one-time-code" required value={code} error={errors.code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
              {previewCode ? <p className="auth-note">Mail is not set up on this server yet. Use code {previewCode}.</p> : null}
              <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Confirm code'}</Button>
            </form>
          ) : (
            <form className="signup__form" onSubmit={submit} noValidate>
              <h2>Sign in</h2>
              <p>Use the same account for subscriptions, quick orders, and saved addresses.</p>
              {notice ? <p className="success-banner" role="status">{notice}</p> : null}
              <TextField id="login-email" label="Email" type="email" autoComplete="email" required value={email} error={errors.email} onChange={(event) => setEmail(event.target.value)} />
              <PasswordField id="login-password" label="Password" autoComplete="current-password" value={password} error={errors.password} onChange={setPassword} />
              <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
              <p className="signup__switch">
                <Link to="/forgot-password">Forgot password</Link>
                <Link to="/register" state={{ from: location.state?.from }}>Create an account</Link>
              </p>
            </form>
          )}
          {unverified ? <Button variant="outline" disabled={busy} onClick={resend}>Send a new verification link</Button> : null}
          {otpEnabled ? <p className="signup__switch">A one-time code is required after the password.</p> : null}
        </>
      )}
    </AuthSplit>
  )
}
