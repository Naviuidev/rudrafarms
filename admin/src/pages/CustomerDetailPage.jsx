import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { CustomersError, fetchAdminCustomer } from '../api/customersApi.js'
import OrdersPage from './OrdersPage.jsx'

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!customerId) return undefined
    let cancel = false
    setError('')
    fetchAdminCustomer(customerId)
      .then((res) => {
        if (!cancel) setData(res)
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof CustomersError ? e.message : 'Could not load customer.')
      })
    return () => {
      cancel = true
    }
  }, [customerId])

  const c = data?.customer
  const embeddedOrderFilters = useMemo(
    () => (c?.id ? { customerId: c.id } : null),
    [c?.id],
  )

  return (
    <>
      <DocumentTitle title={c ? c.name : 'Customer'} />
      <div className="page-heading">
        <p className="eyebrow">Customers</p>
        <h1>{c ? c.name : 'Customer'}</h1>
        <p><Link to="/customers">← All customers</Link></p>
      </div>

      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {!c && !error ? <p role="status">Loading…</p> : null}

      {c ? (
        <>
          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h2>Contact</h2>
            <p><strong>{c.email}</strong></p>
            {c.phone ? <p className="muted">{c.phone}</p> : null}
            <p className="muted" style={{ fontSize: '12px' }}>
              ID: {c.id} · Joined {c.createdAt}
              {c.emailVerifiedAt ? ` · Verified ${c.emailVerifiedAt}` : ''}
            </p>
          </div>

          <div className="panel" style={{ marginBottom: '1rem' }}>
            <h2>Saved addresses</h2>
            {(data.addresses || []).length === 0 ? (
              <p className="muted">No saved addresses.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {data.addresses.map((a) => (
                  <li key={a.id} style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0' }}>
                    {a.isDefault ? <span className="eyebrow" style={{ marginRight: '0.5rem' }}>Default</span> : null}
                    <p style={{ margin: 0 }}>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '14px' }}>{a.city}, {a.state} {a.pin}</p>
                    <p className="muted" style={{ fontSize: '13px', margin: '0.25rem 0 0' }}>
                      {a.contactName} · {a.contactPhone}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {embeddedOrderFilters ? (
            <OrdersPage key={customerId} embedded initialFilters={embeddedOrderFilters} />
          ) : null}
        </>
      ) : null}
    </>
  )
}
