import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { CheckoutError, cancelSubscriptionOrder, loadOrder, payWithRazorpay, requestOrderCancellation, reorderPlace, verifyQuickPayment } from '../api/checkoutApi.js'
import { formatPrice } from '../data/catalog.js'
import { useShop } from '../context/shopContext.js'

const STEPS = ['Placed', 'Packing', 'On the way', 'Delivered']

const CANCEL_REASONS = [
  { id: 'away', label: 'Going away' },
  { id: 'price', label: 'Too expensive' },
  { id: 'timing', label: 'Delivery time does not work' },
  { id: 'quality', label: 'Product quality' },
  { id: 'mistake', label: 'Ordered by mistake' },
  { id: 'one-time', label: 'Switching to one-time orders' },
]

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const [search] = useSearchParams()
  const confirmed = search.get('confirmed') === '1'
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('loading')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const { account, defaultAddress } = useShop()

  useEffect(() => {
    let cancel = false
    setStatus('loading')
    loadOrder(orderId).then((result) => {
      if (cancel) return
      setOrder(result.order)
      setError('')
      setStatus('ready')
    }).catch((reason) => {
      if (cancel) return
      setOrder(null)
      setError(reason instanceof CheckoutError ? reason.message : 'That order could not be loaded.')
      setStatus('error')
    })
    return () => {
      cancel = true
    }
  }, [orderId])

  if (status === 'loading') {
    return (
      <section className="section order-track">
        <DocumentTitle title="Order" />
        <div className="order-track__sheet"><p className="order-track__loading" role="status">Loading order…</p></div>
      </section>
    )
  }

  if (status === 'error' || !order) {
    return (
      <section className="section order-track">
        <DocumentTitle title="Order" />
        <div className="order-track__sheet">
          <ErrorState title="Order unavailable" message={error} action={<Button to="/orders">Back to orders</Button>} />
        </div>
      </section>
    )
  }

  const hero = arrival(order, confirmed)
  const step = stepIndex(order.status)
  const address = order.address || {}
  const place = [address.line2, address.landmark, address.city, address.state, address.pin].filter(Boolean).join(', ')
  const canCancel = order.deliveryType === 'quick' && order.paymentStatus === 'paid' && ['confirmed', 'preparing', 'assigned', 'out_for_delivery'].includes(order.status)
  const canCancelSubscription = Boolean(order.subscriptionId)
    && !order.cancellationRequested
    && !['cancelled', 'failed', 'delivered'].includes(order.status)
  const canReorder = order.deliveryType === 'quick' && order.paymentStatus === 'paid'

  async function cancelOrder() {
    setActionError('')
    setBusy(true)
    try {
      await requestOrderCancellation(order.id)
      const next = await loadOrder(orderId)
      setOrder(next.order)
    } catch (reason) {
      setActionError(reason instanceof CheckoutError ? reason.message : 'Could not request cancellation.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCancelSubscription() {
    if (!cancelReason) {
      setActionError('Choose a reason to cancel this subscription.')
      return
    }
    setActionError('')
    setBusy(true)
    try {
      const next = await cancelSubscriptionOrder(order.id, cancelReason)
      setOrder(next.order)
      setCancelOpen(false)
      setCancelReason('')
    } catch (reason) {
      setActionError(reason instanceof CheckoutError ? reason.message : 'Could not cancel this subscription.')
    } finally {
      setBusy(false)
    }
  }

  async function reorder() {
    setActionError('')
    if (!account || !defaultAddress) {
      setActionError('Sign in with a saved address to reorder.')
      return
    }
    setBusy(true)
    try {
      const placed = await reorderPlace({
        orderId: order.id,
        notes: order.deliveryNote || '',
        coupon: '',
      })
      const newOrderId = placed.order?.id
      const payment = placed.razorpay
      if (!newOrderId || !payment) throw new CheckoutError('Reorder could not be started.')
      if (payment.mock) {
        await verifyQuickPayment({ orderId: newOrderId, mock: true })
        window.location.href = `/orders/${newOrderId}?confirmed=1`
        return
      }
      await payWithRazorpay({
        payment,
        orderId: newOrderId,
        description: placed.order?.orderNumber,
        prefill: {
          name: account.name,
          email: account.email,
          contact: defaultAddress.contactPhone,
        },
      })
      window.location.href = `/orders/${newOrderId}?confirmed=1`
    } catch (reason) {
      setActionError(reason instanceof CheckoutError ? reason.message : 'Reorder failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section order-track">
      <DocumentTitle title={`Order ${order.orderNumber}`} />
      <div className="order-track__sheet">
        <header className={`order-track__hero order-track__hero--${hero.tone}`}>
          <p className="order-track__kicker">{hero.kicker}</p>
          <h1>{hero.title}</h1>
          <p className="order-track__when">{whenLabel(order)}</p>
          <p className="order-track__id">{order.orderNumber}</p>
          {step >= 0 ? (
            <ol className="order-steps" style={{ '--step': step }}>
              {STEPS.map((label, index) => (
                <li key={label} className={index <= step ? 'is-done' : ''} aria-current={index === step ? 'step' : undefined}>
                  <span className="order-steps__dot" />
                  {label}
                </li>
              ))}
            </ol>
          ) : null}
          {order.cancellationRequested ? <p className="order-track__note">Cancellation requested. We will update this order shortly.</p> : null}
          {order.cancellationReason ? <p className="order-track__note">Reason: {order.cancellationReason}</p> : null}
          {order.refundStatus ? <p className="order-track__note">Refund: {order.refundStatus.replaceAll('_', ' ')}</p> : null}
          {order.subscriptionId ? <p className="order-track__note"><Link to={`/subscriptions/${order.subscriptionId}`}>View subscription</Link></p> : null}
        </header>

        <section className="order-track__card">
          <h2>{order.items.length} {order.items.length === 1 ? 'item' : 'items'} in this order</h2>
          <ul className="order-items">
            {order.items.map((line) => (
              <li key={`${line.productId}:${line.variantId}`}>
                <span className="order-items__qty">{line.qty}</span>
                <span className="order-items__name">
                  {line.name}
                  {line.unit ? <small>{line.unit}</small> : null}
                </span>
                <span className="order-items__price">{formatPrice(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="order-track__card">
          <h2>Bill details</h2>
          <dl className="order-bill">
            <div>
              <dt>Item total</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount > 0 ? (
              <div>
                <dt>Coupon{order.couponCode ? ` ${order.couponCode}` : ''}</dt>
                <dd className="order-bill__save">−{formatPrice(order.discount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Delivery charge</dt>
              <dd className={order.deliveryFee === 0 ? 'order-bill__free' : ''}>{order.deliveryFee === 0 ? 'FREE' : formatPrice(order.deliveryFee)}</dd>
            </div>
            {order.tax > 0 ? (
              <div>
                <dt>Tax</dt>
                <dd>{formatPrice(order.tax)}</dd>
              </div>
            ) : null}
            <div className="order-bill__total">
              <dt>To pay</dt>
              <dd>{formatPrice(order.payable)}</dd>
            </div>
          </dl>
        </section>

        <section className="order-track__card">
          <h2>Delivery address</h2>
          <p className="order-address__line">{address.line1}</p>
          {place ? <p className="order-address__place">{place}</p> : null}
          <p className="order-address__place">{[address.contactName, address.contactPhone].filter(Boolean).join(' · ')}</p>
          {order.deliveryNote ? <p className="order-address__note">{order.deliveryNote}</p> : null}
        </section>

        {actionError ? <p className="order-track__alert" role="alert">{actionError}</p> : null}

        <div className="order-track__actions">
          {canReorder ? (
            <Button type="button" disabled={busy} onClick={reorder}>Order again</Button>
          ) : (
            <Button to="/shop">Shop again</Button>
          )}
          {canCancelSubscription ? (
            <button type="button" className="order-track__cancel" disabled={busy} onClick={() => { setActionError(''); setCancelOpen(true) }}>Cancel subscription</button>
          ) : null}
          {canCancel ? (
            <button type="button" className="order-track__cancel" disabled={busy} onClick={cancelOrder}>Cancel order</button>
          ) : null}
          <Link className="order-track__back" to="/orders">All orders</Link>
        </div>
      </div>
      <Dialog open={cancelOpen} title="Cancel subscription" onClose={() => { if (!busy) setCancelOpen(false) }}>
        <p className="cancel-reasons__lead">Choose why you are stopping this plan. An unpaid bill is cancelled. A paid bill stays until the shop confirms it.</p>
        <fieldset className="cancel-reasons">
          <legend className="sr-only">Cancellation reason</legend>
          {CANCEL_REASONS.map((item) => (
            <label key={item.id}>
              <input
                type="radio"
                name="cancel-reason"
                value={item.id}
                checked={cancelReason === item.id}
                onChange={() => setCancelReason(item.id)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
        <div className="cancel-reasons__actions">
          <Button type="button" disabled={busy || !cancelReason} onClick={confirmCancelSubscription}>
            {busy ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep it</Button>
        </div>
      </Dialog>
    </section>
  )
}

function arrival(order, confirmed) {
  if (order.status === 'delivered') return { kicker: 'Order complete', title: 'Delivered', tone: 'done' }
  if (order.status === 'cancelled') return { kicker: 'This order was cancelled', title: 'Cancelled', tone: 'bad' }
  if (order.status === 'failed') return { kicker: 'Payment did not finish', title: 'Order failed', tone: 'bad' }
  if (order.status === 'out_for_delivery') return { kicker: 'Out for delivery', title: 'On the way', tone: 'live' }
  if (order.status === 'preparing' || order.status === 'assigned') return { kicker: 'We are packing this', title: 'Packing your order', tone: 'live' }
  if (order.status === 'pending_payment') return { kicker: 'Finish payment to confirm', title: 'Payment pending', tone: 'wait' }
  if (order.etaMinutes > 0) return { kicker: confirmed ? 'Order placed' : 'Order confirmed', title: `Arriving in ~${order.etaMinutes} min`, tone: 'live' }
  return { kicker: confirmed ? 'Order placed' : 'Order confirmed', title: order.slotLabel || 'Order confirmed', tone: 'live' }
}

function stepIndex(status) {
  if (status === 'delivered') return 3
  if (status === 'out_for_delivery') return 2
  if (status === 'preparing' || status === 'assigned') return 1
  if (status === 'confirmed' || status === 'paid') return 0
  return -1
}

function whenLabel(order) {
  const bits = []
  if (order.slotDate) {
    const [year, month, day] = order.slotDate.split('-').map(Number)
    const date = new Date(year, (month || 1) - 1, day || 1)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const diff = Math.round((date - start) / 86400000)
    if (diff === 0) bits.push('Today')
    else if (diff === 1) bits.push('Tomorrow')
    else bits.push(date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }))
  }
  if (order.slotLabel) bits.push(order.slotLabel)
  return bits.join(' · ')
}
