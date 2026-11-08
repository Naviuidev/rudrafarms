import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { AuthError, forgotPassword } from '../api/authApi.js'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const result = await forgotPassword(email)
      setMessage(result.message || 'If an account exists for that email, a reset link is on its way.')
      setPreviewUrl(result.previewUrl || '')
    } catch (reason) {
      if (reason instanceof AuthError && reason.fields.email) setError(reason.fields.email)
      else setMessage(reason instanceof Error ? reason.message : 'The reset link could not be requested.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <DocumentTitle title="Forgot password" />
      <div className="container narrow">
        <div className="panel auth-card">
          <p className="eyebrow">Account</p>
          <h1>Forgot password</h1>
          <p>Enter the email on the account. The reset link expires in one hour.</p>
          {message ? <p className="success-banner" role="status">{message}</p> : null}
          {previewUrl ? <p className="auth-note">Email is not configured on this server. Open the reset link: <a href={previewUrl}>{previewUrl}</a></p> : null}
          <form className="form-grid" onSubmit={submit} noValidate>
            <TextField id="forgot-email" label="Email" type="email" autoComplete="email" required value={email} error={error} onChange={(event) => setEmail(event.target.value)} />
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
          </form>
          <p><Link to="/login">Back to sign in</Link></p>
        </div>
      </div>
    </section>
  )
}
