import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Logo from '@brand/components/Logo.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { adminSignedIn, signInAdmin } from '../auth/session.js'

export default function AdminLoginPage() {
  const showToast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState(() => adminSignedIn())

  function submit(event) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter the username and password.')
      return
    }
    if (!signInAdmin(username, password)) {
      setError('The username or password is not correct.')
      return
    }
    showToast({ title: 'Welcome back', message: 'The control center is open.' })
    setAuthed(true)
  }

  if (authed || adminSignedIn()) return <Navigate to="/" replace />

  return (
    <div className="auth-split auth-login">
      <DocumentTitle title="Admin sign in" />
      <form className="auth-login__card" onSubmit={submit} noValidate>
        <Logo to="/login" />
        <p className="auth-login__kicker">Control center</p>
        <h1>Sign in</h1>
        <p className="auth-login__lead">Staff access for the farm store. Customers use the shop site.</p>
        <ul className="auth-login__areas">
          <li>Products</li>
          <li>Orders</li>
          <li>Subscriptions</li>
          <li>Deliveries</li>
        </ul>
        {error ? <p className="auth-login__error" role="alert">{error}</p> : null}
        <TextField id="admin-username" label="Username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
        <TextField id="admin-password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <Button type="submit">Continue</Button>
      </form>
    </div>
  )
}
