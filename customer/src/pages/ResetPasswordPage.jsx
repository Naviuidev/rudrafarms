import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { resetPassword } from '../api/authApi.js'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const showToast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const next = {}
    if (!token) next.form = 'This reset link is missing its token.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      showToast({ title: 'Password updated', message: 'Sign in with the new password.' })
    } catch (reason) {
      setErrors({ form: reason instanceof Error ? reason.message : 'The password could not be reset.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <DocumentTitle title="Reset password" />
      <div className="container narrow">
        <div className="panel auth-card">
          <p className="eyebrow">Account</p>
          <h1>Choose a new password</h1>
          {errors.form ? <div className="form-alert" role="alert">{errors.form}</div> : null}
          {done ? (
            <Button to="/login">Sign in</Button>
          ) : (
            <form className="form-grid" onSubmit={submit} noValidate>
              <TextField id="reset-password" label="New password" type="password" autoComplete="new-password" required value={password} error={errors.password} onChange={(event) => setPassword(event.target.value)} />
              <TextField id="reset-confirm" label="Confirm password" type="password" autoComplete="new-password" required value={confirm} error={errors.confirm} onChange={(event) => setConfirm(event.target.value)} />
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</Button>
            </form>
          )}
          <p><Link to="/login">Back to sign in</Link></p>
        </div>
      </div>
    </section>
  )
}
