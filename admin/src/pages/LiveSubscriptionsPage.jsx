import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'
import {
  SubscriptionsAdminError,
  fetchAdminSubscriptions,
  setAdminSubscriptionStatus,
} from '../api/subscriptionsAdminApi.js'

const statuses = ['', 'active', 'paused', 'pending_payment', 'expired', 'cancelled']

function formatDay(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return value || ''
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatInr(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round((Number(paise) || 0) / 100))
}

export default function LiveSubscriptionsPage() {
  const [rows, setRows] = useState([])
  const [renewals, setRenewals] = useState([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

  const load = useCallback((options = {}) => {
    const silent = options.silent === true
    if (!silent) setError('')
    return fetchAdminSubscriptions({ status, search: search.trim(), limit: 120 })
      .then((data) => {
        setRows(data.subscriptions)
        setRenewals(data.renewals)
        setError('')
        setUpdatedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
      })
      .catch((e) => setError(e instanceof SubscriptionsAdminError ? e.message : 'Could not load subscriptions.'))
  }, [status, search])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(() => load({ silent: true }), 15000)

  async function changeStatus(id, next) {
    setBusy(true)
    try {
      await setAdminSubscriptionStatus(id, next)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DocumentTitle title="Subscriptions" />
      <div className="page-heading">
        <p className="eyebrow">Subscriptions</p>
        <h1>Customer subscriptions</h1>
        <p>Active, paused, expired, and cancelled plans. Status changes are manual. Customers still pay each cycle themselves.</p>
        {updatedAt ? <p className="muted">Live · refreshed {updatedAt}</p> : null}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="admin-form admin-form--inline" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone" />
          <label className="field">
            <span className="field__label">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s || 'any'} value={s}>{s ? s.replace(/_/g, ' ') : 'All'}</option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={load} disabled={busy}>Refresh</Button>
          <Button to="/subscriptions/plans" variant="outline">Manage plans</Button>
        </div>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Upcoming renewals (7 days)</h2>
        <p className="muted">Paid cycles ending soon. The customer starts the next payment from their account.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Ends</th><th>Customer</th><th>Schedule</th><th>Amount</th><th>Sub status</th></tr>
            </thead>
            <tbody>
              {renewals.map((r) => (
                <tr key={r.cycleId}>
                  <td>{r.periodEnd}</td>
                  <td>
                    <Link to={`/customers/${r.customerId}`}>{r.customerName}</Link>
                    <div className="muted" style={{ fontSize: '12px' }}>{r.customerEmail}</div>
                  </td>
                  <td>{r.scheduleKey}</td>
                  <td>{formatInr(r.amountPaise)}</td>
                  <td>{r.subscriptionStatus.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renewals.length === 0 ? <p className="muted">No renewals in the next 7 days.</p> : null}
      </div>

      <div className="panel">
        <h2>All subscriptions</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Schedule</th>
                <th>Start</th>
                <th>Skipped days</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/customers/${row.customerId}`}>{row.customerName}</Link>
                    <div className="muted" style={{ fontSize: '12px' }}>{row.customerEmail}</div>
                  </td>
                  <td>{row.planName || 'Custom'}</td>
                  <td>{row.scheduleKey}</td>
                  <td>{row.startDate}</td>
                  <td>{(row.skips || []).length === 0 ? '—' : row.skips.map(formatDay).join(', ')}</td>
                  <td>{row.status.replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{row.updatedAt}</td>
                  <td>
                    {row.status !== 'active' && row.status !== 'cancelled' ? (
                      <button type="button" className="link-button" disabled={busy} onClick={() => changeStatus(row.id, 'active')}>Resume</button>
                    ) : null}
                    {row.status === 'active' ? (
                      <button type="button" className="link-button" disabled={busy} onClick={() => changeStatus(row.id, 'paused')}>Pause</button>
                    ) : null}
                    {row.status !== 'cancelled' ? (
                      <button type="button" className="link-button" disabled={busy} onClick={() => {
                        if (window.confirm('Cancel this subscription?')) changeStatus(row.id, 'cancelled')
                      }}>Cancel</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className="muted">No subscriptions match these filters.</p> : null}
      </div>
    </>
  )
}
