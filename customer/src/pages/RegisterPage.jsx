import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { AuthError, registerAccount, requestSignupCode, verifySignupCode } from '../api/authApi.js'
import AuthSplit from '../components/AuthSplit.jsx'
import PasswordField from '../components/PasswordField.jsx'
import { safeReturnPath } from '../lib/authPaths.js'
import { useShop } from '../context/shopContext.js'

const steps = ['Email', 'Code', 'Account']

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = safeReturnPath(location.state?.from)
  const { login } = useShop()
  const showToast = useToast()
  const authLinkState = { from: location.state?.from }
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [signupToken, setSignupToken] = useState('')
  const [previewCode, setPreviewCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(event) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Enter a valid email address.' })
      return
    }
    setErrors({})
    setFormError('')
    setBusy(true)
    try {
      const result = await requestSignupCode(email)
      setChallengeId(result.challengeId || '')
      setPreviewCode(result.previewCode || '')
      setCode('')
      setStep(1)
    } catch (reason) {
      if (reason instanceof AuthError) setErrors(reason.fields)
      setFormError(reason instanceof Error ? reason.message : 'The code could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  async function checkCode(event) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: 'Enter the 6-digit code.' })
      return
    }
    setErrors({})
    setFormError('')
    setBusy(true)
    try {
      const result = await verifySignupCode(challengeId, code)
      setSignupToken(result.signupToken || '')
      setStep(2)
    } catch (reason) {
      if (reason instanceof AuthError) setErrors(reason.fields)
      setFormError(reason instanceof Error ? reason.message : 'That code could not be checked.')
    } finally {
      setBusy(false)
    }
  }

  async function createAccount(event) {
    event.preventDefault()
    const next = {}
    if (firstName.trim().length < 1) next.firstName = 'Enter your first name.'
    if (lastName.trim().length < 1) next.lastName = 'Enter your last name.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    setFormError('')
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await registerAccount({ signupToken, firstName, lastName, password })
      const session = await login(email, password)
      if (session?.otpRequired) {
        navigate('/login', {
          replace: true,
          state: {
            from: location.state?.from,
            email,
            challengeId: session.challengeId,
            previewCode: session.previewCode || '',
          },
        })
        return
      }
      showToast({ title: 'Welcome', message: 'Your account is ready.' })
      navigate(returnTo, { replace: true })
    } catch (reason) {
      if (reason instanceof AuthError) setErrors(reason.fields)
      setFormError(reason instanceof Error ? reason.message : 'The account could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthSplit title="Create account">
        <ol className="signup-steps" aria-label="Signup progress">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? 'is-current' : index < step ? 'is-done' : undefined}>
              <span className="signup-steps__dot" aria-hidden="true" />
              <span className="signup-steps__label">{label}</span>
            </li>
          ))}
        </ol>
        {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
        {step === 0 ? (
          <form className="signup__form" onSubmit={sendCode} noValidate>
            <h2>Let’s get started</h2>
            <p>Enter the email for your account. We’ll send a 6-digit code next.</p>
            <TextField id="signup-email" label="Email" type="email" autoComplete="email" required value={email} error={errors.email} onChange={(event) => setEmail(event.target.value)} />
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Continue'}</Button>
            <p className="signup__switch">Already registered? <Link to="/login" state={authLinkState}>Sign in</Link></p>
          </form>
        ) : null}
        {step === 1 ? (
          <form className="signup__form" onSubmit={checkCode} noValidate>
            <h2>Enter the code</h2>
            <p>We sent a 6-digit code to {email}. It expires in 10 minutes.</p>
            <TextField id="signup-code" label="Email code" inputMode="numeric" autoComplete="one-time-code" required value={code} error={errors.code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            {previewCode ? <p className="auth-note">Mail is not set up on this server yet. Use code {previewCode}.</p> : null}
            <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</Button>
            <p className="signup__switch">Already registered? <Link to="/login" state={authLinkState}>Sign in</Link></p>
            <div className="signup__row">
              <button type="button" className="text-button" disabled={busy} onClick={() => { setStep(0); setFormError('') }}>Change email</button>
              <button type="button" className="text-button" disabled={busy} onClick={sendCode}>Send a new code</button>
            </div>
          </form>
        ) : null}
        {step === 2 ? (
          <form className="signup__form" onSubmit={createAccount} noValidate>
            <h2>Create your account</h2>
            <p>This email is confirmed. Choose the name and password you’ll use to sign in.</p>
            <div className="signup__names">
              <TextField id="signup-first" label="First name" autoComplete="given-name" required value={firstName} error={errors.firstName} onChange={(event) => setFirstName(event.target.value)} />
              <TextField id="signup-last" label="Last name" autoComplete="family-name" required value={lastName} error={errors.lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
            <PasswordField id="signup-password" label="Password" autoComplete="new-password" value={password} error={errors.password} onChange={setPassword} />
            <PasswordField id="signup-confirm" label="Confirm password" autoComplete="new-password" value={confirm} error={errors.confirm} onChange={setConfirm} />
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
            <p className="signup__switch">Already registered? <Link to="/login" state={authLinkState}>Sign in</Link></p>
          </form>
        ) : null}
    </AuthSplit>
  )
}
