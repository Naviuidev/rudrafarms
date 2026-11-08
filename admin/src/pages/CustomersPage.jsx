import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { CustomersError, fetchAdminCustomers } from '../api/customersApi.js'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'

export default function CustomersPage() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback((options = {}) => {
    const silent = options.silent === true
    if (!silent) {
      setError('')
      setBusy(true)
    }
    return fetchAdminCustomers({ search: search.trim(), limit: 120 })
      .then(setRows)
      .catch((e) => setError(e instanceof CustomersError ? e.message : 'Could not load customers.'))
      .finally(() => {
        if (!silent) setBusy(false)
      })
  }, [search])

  useEffect(() => {
    load()
  }, [])

  useLiveRefresh(() => load({ silent: true }), 20000)

  return (
    <>
      <DocumentTitle title="Customers" />
      <div className="page-heading">
        <p className="eyebrow">Accounts</p>
        <h1>Customers</h1>
        <p>Registered shoppers and subscription holders.</p>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <form className="admin-form admin-form--inline" style={{ alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }} onSubmit={(event) => { event.preventDefault(); load() }}>
          <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone" />
          <Button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</Button>
        </form>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Verified</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {!busy && rows.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={6}>No customers match this search.</td>
                </tr>
              ) : null}
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                  <td>{c.email}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.orderCount}</td>
                  <td>{c.emailVerifiedAt ? 'Yes' : '—'}</td>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{c.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
