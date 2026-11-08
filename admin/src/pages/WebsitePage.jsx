import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { OrdersError, fetchAdminOrders } from '../api/ordersApi.js'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'
import { websiteSection, websiteSections } from '../website/sections.js'

function formatInr(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0)
}

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WebsitePage() {
  const [params] = useSearchParams()
  const section = websiteSection(params.get('section'))
  const meta = websiteSections.find((item) => item.id === section) || websiteSections[0]
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback((options = {}) => {
    const silent = options.silent === true
    if (!silent) {
      setError('')
      setBusy(true)
    }
    return fetchAdminOrders({ bucket: section, limit: 200 })
      .then(setRows)
      .catch((reason) => setError(reason instanceof OrdersError ? reason.message : 'Could not load these payments.'))
      .finally(() => {
        if (!silent) setBusy(false)
      })
  }, [section])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(() => load({ silent: true }), 15000)

  const showReason = section === 'cancelled'

  return (
    <>
      <DocumentTitle title={meta.title} />
      <div className="page-heading">
        <p className="eyebrow">Website</p>
        <h1>{meta.title}</h1>
        <p>{meta.copy}</p>
      </div>
      <div className="panel">
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Pay</th>
                <th>Amount</th>
                {showReason ? <th>Reason</th> : null}
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {!busy && rows.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={showReason ? 8 : 7}>Nothing in this list yet.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td><Link to={`/orders/${row.id}`}>{row.orderNumber}</Link></td>
                  <td>
                    {row.customerName}
                    <br />
                    <span className="muted">{row.customerEmail}</span>
                  </td>
                  <td>{row.deliveryType}{row.slotLabel ? ` · ${row.slotLabel}` : ''}</td>
                  <td>{String(row.status || '').replaceAll('_', ' ')}</td>
                  <td>{String(row.paymentStatus || '').replaceAll('_', ' ')}</td>
                  <td>{formatInr(row.payable)}</td>
                  {showReason ? <td>{row.cancellationReason || '—'}</td> : null}
                  <td>{formatWhen(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
