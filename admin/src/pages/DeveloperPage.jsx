import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { unlockDatabaseConfig } from '../api/databaseApi.js'
import { listFarmData } from '../api/farmDataApi.js'
import { openMailSettings } from '../api/settingsApi.js'
import { developerSection } from '../developer/sections.js'
import { unlockPaymentConfig } from '../api/paymentsApi.js'
import DatabaseConfigPage from './DatabaseConfigPage.jsx'
import EmailConfigPanel from './EmailConfigPanel.jsx'
import FarmDataPage from './FarmDataPage.jsx'
import PaymentsPage from './PaymentsPage.jsx'

const gates = {
  payments: {
    title: 'Config payment',
    copy: 'Enter the payments password to open Razorpay settings.',
  },
  database: {
    title: 'DB config',
    copy: 'Enter the database password to open the localhost and production connection.',
  },
  email: {
    title: 'Email config',
    copy: 'Enter the email password to open Gmail settings.',
  },
  data: {
    title: 'Farm fresh data',
    copy: 'Enter the data password to open users, products, orders, and the other records.',
  },
}

export default function DeveloperPage() {
  const [params] = useSearchParams()
  const section = developerSection(params.get('section'))
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState({ payments: null, database: null, email: '', data: '' })

  useEffect(() => {
    setPassword('')
    setError('')
  }, [section])

  async function unlock(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (section === 'email') {
        await openMailSettings(password)
        setSession((current) => ({ ...current, email: password }))
      } else if (section === 'data') {
        await listFarmData('users', password)
        setSession((current) => ({ ...current, data: password }))
      } else if (section === 'database') {
        const config = await unlockDatabaseConfig(password)
        setSession((current) => ({ ...current, database: { password, config } }))
      } else {
        const config = await unlockPaymentConfig(password)
        setSession((current) => ({ ...current, payments: { password, config } }))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That password is not correct.')
    } finally {
      setBusy(false)
    }
  }

  const gate = gates[section] || gates.payments
  const open = section === 'email' ? session.email : section === 'data' ? session.data : section === 'database' ? session.database : session.payments
  if (!open) {
    return (
      <>
        <DocumentTitle title={gate.title} />
        <div className="page-heading">
          <p className="eyebrow">Developer</p>
          <h1>{gate.title}</h1>
          <p>{gate.copy}</p>
        </div>
        <form className="panel settings-form developer-sheet" onSubmit={unlock} noValidate>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <TextField
            id="developer-password"
            label="Password"
            type="password"
            autoComplete="off"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</Button>
        </form>
      </>
    )
  }

  if (section === 'email') return <EmailConfigPanel password={session.email} />
  if (section === 'data') return <FarmDataPage password={session.data} />
  if (section === 'database') return <DatabaseConfigPage password={session.database.password} initialConfig={session.database.config} />
  return <PaymentsPage password={session.payments.password} initialConfig={session.payments.config} />
}
