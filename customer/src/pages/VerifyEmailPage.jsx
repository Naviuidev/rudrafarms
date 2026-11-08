import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { verifyEmail } from '../api/authApi.js'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState({ status: 'working', message: '' })

  useEffect(() => {
    if (!token) {
      return undefined
    }
    const gate = { current: false }
    verifyEmail(token).then((result) => {
      if (!gate.current) setState({ status: 'done', message: result.message || 'Your email is verified.' })
    }).catch((reason) => {
      if (!gate.current) setState({ status: 'error', message: reason instanceof Error ? reason.message : 'This link could not be checked.' })
    })
    return () => {
      gate.current = true
    }
  }, [token])

  const message = !token
    ? 'This verification link is missing its token.'
    : state.status === 'working'
      ? 'Checking the verification link…'
      : state.message

  return (
    <section className="section">
      <DocumentTitle title="Verify email" />
      <div className="container narrow">
        <div className="panel auth-card">
          <p className="eyebrow">Account</p>
          <h1>Email verification</h1>
          <p role="status" className={state.status === 'error' || !token ? 'form-alert' : 'success-banner'}>{message}</p>
          <Button to="/login">Sign in</Button>
          <p><Link to="/">Back to the store</Link></p>
        </div>
      </div>
    </section>
  )
}
