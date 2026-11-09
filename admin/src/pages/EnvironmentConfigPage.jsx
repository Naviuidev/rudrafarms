import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { loadEnvironmentOverview } from '../api/environmentApi.js'
import { developerSections } from '../developer/sections.js'

function StatusPill({ ok, yes, no }) {
  return <span className={ok ? 'config-status config-status--ok' : 'config-status config-status--warn'}>{ok ? yes : no}</span>
}

export default function EnvironmentConfigPage() {
  const [, setParams] = useSearchParams()
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  function refresh() {
    setBusy(true)
    setError('')
    loadEnvironmentOverview()
      .then((data) => setOverview(data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load overview.'))
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  const configurables = developerSections.filter((item) => item.id !== 'overview')

  return (
    <>
      <DocumentTitle title="Configs overview" />
      <div className="page-heading">
        <p className="eyebrow">Configs</p>
        <h1>Overview</h1>
        <p>
          What the API is using right now. Change database, Razorpay, or email in the sections on the left — you do not need to edit
          files in Hostinger <code>public_html</code>.
        </p>
      </div>

      {error ? <p className="field__error" role="alert">{error}</p> : null}

      <div className="config-overview">
        {busy && !overview ? <p className="muted">Loading…</p> : null}
        {overview ? (
          <>
            <section className="panel config-overview__card">
              <h2>Active profile</h2>
              <p className="config-overview__lead">
                <strong>{overview.activeMode === 'production' ? 'Production' : 'Localhost'}</strong>
                {' '}
                — the server is running the
                {' '}
                <code>{overview.activeMode}</code>
                {' '}
                values from
                {' '}
                <code>backend/.env</code>
                .
              </p>
              <ul className="config-overview__list">
                <li>
                  <span>API</span>
                  <code>{overview.urls.api || '—'}</code>
                </li>
                <li>
                  <span>Shop</span>
                  <code>{overview.urls.customer || '—'}</code>
                </li>
                <li>
                  <span>Admin</span>
                  <code>{overview.urls.admin || '—'}</code>
                </li>
              </ul>
            </section>

            <section className="panel config-overview__card">
              <h2>Health</h2>
              <ul className="config-overview__checks">
                <li>
                  Database connection
                  {' '}
                  <StatusPill ok={overview.database.connected} yes="Connected" no="Not connected" />
                </li>
                <li>
                  Env file on server
                  {' '}
                  <StatusPill ok={overview.envFile.exists} yes="Present" no="Missing" />
                  {overview.envFile.writable ? ' · writable' : overview.envFile.exists ? ' · read-only' : ''}
                </li>
                <li>
                  Razorpay
                  {' '}
                  <StatusPill ok={overview.payments.configured} yes="Configured" no="Not set" />
                  {overview.payments.configured ? ` · mode ${overview.payments.activeMode}` : ''}
                </li>
                <li>
                  SMTP email
                  {' '}
                  <StatusPill ok={overview.mailConfigured} yes="Configured" no="Not set" />
                </li>
              </ul>
              {overview.database.host ? (
                <p className="config-overview__meta">
                  DB:
                  {' '}
                  {overview.database.user}
                  @
                  {overview.database.host}
                  /
                  {overview.database.name}
                  {overview.database.hasPassword ? ' · password set' : ' · no password'}
                </p>
              ) : null}
              <p className="config-overview__hint">{overview.envFile.hint}</p>
            </section>

            <section className="panel config-overview__card">
              <h2>Where to edit</h2>
              <p className="config-overview__lead">{overview.localDevNote}</p>
              <div className="config-overview__actions">
                {configurables.map((item) => (
                  <Button key={item.id} type="button" variant="secondary" onClick={() => setParams({ section: item.id })}>
                    {item.label}
                  </Button>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <div className="config-overview__toolbar">
        <Button type="button" variant="secondary" disabled={busy} onClick={refresh}>
          {busy ? 'Refreshing…' : 'Refresh status'}
        </Button>
      </div>
    </>
  )
}
