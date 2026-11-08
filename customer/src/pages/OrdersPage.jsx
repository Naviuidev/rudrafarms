import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { CheckoutError, loadOrders } from '../api/checkoutApi.js'
import { formatPrice } from '../data/catalog.js'
import { useShop } from '../context/shopContext.js'

const FILTERS = [
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending' },
  { id: 'cancelled', label: 'Cancelled' },
]

function orderBucket(order) {
  if (order.status === 'cancelled' || order.status === 'failed' || order.cancellationRequested) return 'cancelled'
  if (order.status === 'pending_payment' || order.paymentStatus === 'pending') return 'pending'
  return 'confirmed'
}

export default function OrdersPage() {
  const { account, authReady } = useShop()
  const location = useLocation()
  const returnFrom = `${location.pathname}${location.search}`
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const [filter, setFilter] = useState('confirmed')

  useEffect(() => {
    if (!account) return undefined
    let cancel = false
    setStatus('loading')
    loadOrders().then((result) => {
      if (cancel) return
      setOrders(result.orders || [])
      setError('')
      setStatus('ready')
    }).catch((reason) => {
      if (cancel) return
      setOrders([])
      setError(reason instanceof CheckoutError ? reason.message : 'Orders could not be loaded.')
      setStatus('error')
    })
    return () => {
      cancel = true
    }
  }, [account])

  if (authReady && !account) {
    return (
      <section className="section account-page">
        <DocumentTitle title="Orders" />
        <div className="container">
          <header className="account-head">
            <h1>Orders</h1>
            <p className="subs-muted">Sign in to track deliveries.</p>
          </header>
          <EmptyState
            title="Sign in to see your orders"
            message="Quick delivery orders and their status stay on your account."
            action={<Button to="/login" state={{ from: returnFrom }}>Sign in</Button>}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="section account-page orders-page">
      <DocumentTitle title="Orders" />
      <div className="container">
        <header className="account-head">
          <h1>Orders</h1>
          <p className="subs-muted">Track quick delivery from payment to door.</p>
        </header>
        <div className="order-filters" role="tablist" aria-label="Order status">
          {FILTERS.map((item) => {
            const count = orders.filter((order) => orderBucket(order) === item.id).length
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={filter === item.id ? 'order-filters__btn order-filters__btn--active' : 'order-filters__btn'}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span>{count}</span>
              </button>
            )
          })}
        </div>
        {status === 'loading' ? <p className="subs-muted" role="status">Loading orders…</p> : null}
        {status === 'error' ? (
          <ErrorState title="Orders unavailable" message={error} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
        ) : null}
        {status === 'ready' && orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            message="When you complete a checkout, it will show up here with live status."
            action={<Button to="/shop">Browse products</Button>}
          />
        ) : null}
        {status === 'ready' && orders.length > 0 ? (
          <OrderList orders={orders.filter((order) => orderBucket(order) === filter)} filter={filter} />
        ) : null}
        <nav className="account-nav" aria-label="Account">
          <Link to="/account">Profile</Link>
          <Link to="/account/settings">Settings</Link>
        </nav>
      </div>
    </section>
  )
}

function OrderList({ orders, filter }) {
  if (orders.length === 0) {
    const copy = {
      confirmed: 'Paid and confirmed orders show here.',
      pending: 'Bills waiting for payment show here.',
      cancelled: 'Cancelled payments show here, with the reason you chose.',
    }
    return <p className="subs-muted">{copy[filter]}</p>
  }

  return (
    <ul className="order-list">
      {orders.map((order) => (
        <li key={order.id} className="order-card">
          <div className="order-card__head">
            <div>
              <p className="subs-label order-card__id">{order.orderNumber}</p>
              <h2>{order.statusLabel}</h2>
              <p className="subs-muted order-card__meta">{order.deliveryType.replace('-', ' ')} · {order.slotLabel}{order.slotDate ? ` · ${order.slotDate}` : ''}</p>
              {order.cancellationReason ? <p className="subs-muted order-card__meta">Reason: {order.cancellationReason}</p> : null}
            </div>
            <strong className="order-card__amount">{formatPrice(order.payable)}</strong>
          </div>
          <p className="subs-muted order-card__addr">{order.address?.line1}{order.address?.pin ? `, ${order.address.pin}` : ''}</p>
          <div className="order-card__actions">
            <Button variant="outline" to={`/orders/${order.id}`}>Track</Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
