import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { OrdersError, adminOrdersCsvUrl, fetchAdminOrders } from '../api/ordersApi.js'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'

function formatInr(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0)
}

const orderStatuses = [
  '', 'pending_payment', 'confirmed', 'preparing', 'assigned', 'out_for_delivery', 'delivered', 'cancelled', 'failed',
]

const payStatuses = ['', 'pending', 'paid', 'failed', 'refunded', 'refund_pending']

const deliveryTypes = ['', 'express', 'scheduled', 'subscription']

function defaultFilters(initial) {
  return {
    from: '',
    to: '',
    status: '',
    paymentStatus: '',
    deliveryType: '',
    search: '',
    customerId: '',
    ...initial,
  }
}

export default function OrdersPage({ embedded = false, initialFilters = null } = {}) {
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState(() => defaultFilters(initialFilters))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState('deliveries')

  const load = useCallback((options = {}) => {
    const silent = options.silent === true
    if (!silent) {
      setError('')
      setBusy(true)
    }
    return fetchAdminOrders({ ...filters, limit: 120 })
      .then(setRows)
      .catch((e) => setError(e instanceof OrdersError ? e.message : 'Could not load orders.'))
      .finally(() => {
        if (!silent) setBusy(false)
      })
  }, [filters])

  useEffect(() => {
    load()
  }, [])

  useLiveRefresh(() => load({ silent: true }), 15000)

  const lockCustomer = Boolean(embedded && initialFilters?.customerId)
  const showCustomerColumn = !lockCustomer
  const visible = rows.filter((row) => (
    kind === 'subscriptions' ? row.deliveryType === 'subscription' : row.deliveryType !== 'subscription'
  ))

  return (
    <>
      {embedded ? null : (
        <>
          <DocumentTitle title="Orders" />
          <div className="page-heading">
            <p className="eyebrow">Quick & subscription</p>
            <h1>Orders</h1>
            <p>Search and filter one-time and subscription billing orders.</p>
          </div>
        </>
      )}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <form className="admin-form admin-form--inline" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }} onSubmit={(event) => { event.preventDefault(); load() }}>
          <TextField label="From" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <TextField label="To" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          <TextField
            label="Search"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Order #, name, email"
            disabled={lockCustomer}
          />
          <label className="field">
            <span className="field__label">Order status</span>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              {orderStatuses.map((s) => (
                <option key={s || 'any'} value={s}>{s ? s.replace(/_/g, ' ') : 'Any'}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Payment</span>
            <select value={filters.paymentStatus} onChange={(e) => setFilters((f) => ({ ...f, paymentStatus: e.target.value }))}>
              {payStatuses.map((s) => (
                <option key={s || 'any'} value={s}>{s ? s.replace(/_/g, ' ') : 'Any'}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Delivery type</span>
            <select value={filters.deliveryType} onChange={(e) => setFilters((f) => ({ ...f, deliveryType: e.target.value }))}>
              {deliveryTypes.map((s) => (
                <option key={s || 'any'} value={s}>{s || 'Any'}</option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={busy}>{busy ? 'Loading…' : 'Apply'}</Button>
          <a className="btn btn--outline" href={adminOrdersCsvUrl({ ...filters, limit: 2000 })} download>
            Export CSV
          </a>
        </form>
        {lockCustomer ? <p className="muted" style={{ marginTop: '0.75rem' }}>Showing orders for this customer only.</p> : null}
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <div className="order-kind" role="tablist" aria-label="Order kind">
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'deliveries'}
            className={kind === 'deliveries' ? 'order-kind__btn order-kind__btn--active' : 'order-kind__btn'}
            onClick={() => setKind('deliveries')}
          >
            Deliveries
            <span>{rows.filter((row) => row.deliveryType !== 'subscription').length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'subscriptions'}
            className={kind === 'subscriptions' ? 'order-kind__btn order-kind__btn--active' : 'order-kind__btn'}
            onClick={() => setKind('subscriptions')}
          >
            Subscriptions
            <span>{rows.filter((row) => row.deliveryType === 'subscription').length}</span>
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                {showCustomerColumn ? <th>Customer</th> : null}
                <th>Type</th>
                <th>Status</th>
                <th>Pay</th>
                <th>Amount</th>
                <th>Razorpay</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {!busy && visible.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={showCustomerColumn ? 8 : 7}>
                    {kind === 'subscriptions' ? 'No subscription orders match these filters.' : 'No delivery orders match these filters.'}
                  </td>
                </tr>
              ) : null}
              {visible.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/orders/${o.id}`}><strong>{o.orderNumber}</strong></Link>
                    <div className="muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{o.id}</div>
                  </td>
                  {showCustomerColumn ? (
                    <td>
                      <div>{o.customerName}</div>
                      <div className="muted" style={{ fontSize: '12px' }}>{o.customerEmail}</div>
                    </td>
                  ) : null}
                  <td>{o.deliveryType}</td>
                  <td>{o.status.replace(/_/g, ' ')}</td>
                  <td>{o.paymentStatus ? o.paymentStatus.replace(/_/g, ' ') : '—'}</td>
                  <td>{formatInr(o.payable)}</td>
                  <td style={{ fontSize: '11px', maxWidth: '140px', wordBreak: 'break-all' }}>
                    {o.razorpayPaymentId || o.razorpayOrderId || '—'}
                  </td>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{o.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
