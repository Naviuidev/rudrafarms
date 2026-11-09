import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { quoteCart } from '../api/cartApi.js'
import CartTotals from '../components/CartTotals.jsx'
import {
  CheckoutError,
  payWithRazorpay,
  placeQuickOrder,
  verifyQuickPayment,
} from '../api/checkoutApi.js'
import { useShop } from '../context/shopContext.js'
import { useWebsiteOrdersGate } from '../hooks/useWebsiteOrdersGate.js'
import { formatPrice } from '../data/catalog.js'

function hasPricingPoint(point) {
  return Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)
}

function cartPayload(items, coupon, pricingPoint, customerId) {
  return {
    items: items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      qty: item.qty,
      deliveryMode: item.deliveryMode === 'subscription' ? 'subscription' : 'quick',
    })),
    coupon,
    ...(customerId ? { customerId } : {}),
    latitude: pricingPoint?.latitude,
    longitude: pricingPoint?.longitude,
    pin: pricingPoint?.pin || '',
    subscriptionSchedule: '',
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnFrom = `${location.pathname}${location.search}`
  const showToast = useToast()
  const {
    account,
    authReady,
    items,
    coupon,
    addresses,
    defaultAddress,
    deliveringAddressId,
    pricingPoint,
    quote: shopQuote,
    quoteStatus,
    quoteError,
    setQty,
    clearCoupon,
  } = useShop()
  const [notes, setNotes] = useState('')
  const [checkoutQuote, setCheckoutQuote] = useState(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const acceptingWebsiteOrders = useWebsiteOrdersGate()
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const quickItems = useMemo(
    () => items.filter((item) => item.deliveryMode !== 'subscription'),
    [items],
  )
  const deliveryAddress = useMemo(() => {
    if (defaultAddress) return defaultAddress
    if (deliveringAddressId) {
      const active = addresses.find((entry) => entry.id === deliveringAddressId)
      if (active) return active
    }
    return addresses.find((entry) => Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude)) || null
  }, [addresses, defaultAddress, deliveringAddressId])
  const quote = checkoutQuote || shopQuote
  const lines = quote.items.filter((line) => line.ok)

  useEffect(() => {
    if (items.some((item) => item.deliveryMode === 'subscription') && quickItems.length === 0) {
      navigate('/subscriptions', { replace: true })
    }
  }, [items, quickItems.length, navigate])

  useEffect(() => {
    if (quickItems.length === 0 || !hasPricingPoint(pricingPoint)) {
      setCheckoutQuote(null)
      return undefined
    }
    let cancel = false
    setQuoteBusy(true)
    const timer = setTimeout(() => {
      quoteCart(cartPayload(quickItems, coupon, pricingPoint, account?.id)).then((next) => {
        if (cancel) return
        setCheckoutQuote(next)
        setQuoteBusy(false)
      }).catch(() => {
        if (cancel) return
        setCheckoutQuote(null)
        setQuoteBusy(false)
      })
    }, 200)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [quickItems, coupon, pricingPoint, account?.id])

  async function pay(event) {
    event.preventDefault()
    const next = {}
    if (!account) next.auth = 'Sign in to place this order.'
    if (!deliveryAddress?.id) next.address = 'Add a delivery address before checkout.'
    if (!hasPricingPoint(pricingPoint)) next.address = next.address || 'Set your location (Deliver to) or choose a saved address with a map pin.'
    if (quoteStatus === 'error' && !checkoutQuote) next.cart = quoteError
    if (!acceptingWebsiteOrders) next.cart = 'The store is closed.'
    if (!quote.serviceable) next.cart = quote.serviceability.message || 'Update the cart before checkout.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const placed = await placeQuickOrder({
        addressId: deliveryAddress.id,
        notes,
        coupon,
        customerId: account?.id,
        items: quickItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          deliveryMode: 'quick',
        })),
      })
      const orderId = placed.order?.id
      const payment = placed.razorpay
      if (!orderId || !payment) {
        throw new CheckoutError('The order could not be started.')
      }

      if (payment.mock) {
        await verifyQuickPayment({ orderId, mock: true })
        quickItems.forEach((item) => setQty(item.key, 0))
        clearCoupon()
        showToast({ title: 'Order confirmed', message: 'Local test payment completed.' })
        navigate(`/orders/${orderId}?confirmed=1`, { replace: true })
        return
      }

      await payWithRazorpay({
        payment,
        orderId,
        description: placed.order.orderNumber,
        prefill: {
          name: account.name,
          email: account.email,
          contact: deliveryAddress.contactPhone,
        },
      })
      quickItems.forEach((item) => setQty(item.key, 0))
      clearCoupon()
      showToast({ title: 'Order confirmed', message: 'Payment received.' })
      navigate(`/orders/${orderId}?confirmed=1`, { replace: true })
    } catch (reason) {
      setErrors({
        form: reason instanceof Error ? reason.message : 'Payment could not be completed.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (quickItems.length === 0) {
    return (
      <section className="section">
        <DocumentTitle title="Checkout" />
        <div className="container">
          <EmptyState
            title={items.length > 0 ? 'Subscription checkout moved' : 'Nothing to check out'}
            message={items.length > 0
              ? 'Monthly subscriptions are paid on the Subscriptions page with one charge per calendar month.'
              : 'Add a product first. Checkout uses your saved delivery address.'}
            action={items.length > 0
              ? <Button to="/subscriptions">Open subscriptions</Button>
              : <Button to="/shop">Browse products</Button>}
          />
        </div>
      </section>
    )
  }

  const canPay = Boolean(deliveryAddress?.id)
    && hasPricingPoint(pricingPoint)
    && acceptingWebsiteOrders
    && quote.serviceable
    && quote.payable > 0

  return (
    <section className="section section--last">
      <DocumentTitle title="Checkout" />
      <div className="container">
        <div className="page-intro">
          <p className="eyebrow">Quick delivery</p>
          <h1>Checkout</h1>
          <p>We deliver as soon as we can. Complete payment below when checkout is open.</p>
        </div>
        <div className="checkout">
          <form className="panel" onSubmit={pay} noValidate>
            {errors.form || errors.auth || errors.address || errors.cart ? (
              <div className="form-alert" role="alert">
                {errors.form || errors.auth || errors.address || errors.cart || 'Please check the highlighted fields.'}
              </div>
            ) : null}
            {deliveryAddress ? (
              <article className="address-card address-card--default">
                <p className="eyebrow">Delivery address</p>
                <h2>{deliveryAddress.line1}</h2>
                <p>
                  {[deliveryAddress.line2, deliveryAddress.landmark, deliveryAddress.city, deliveryAddress.state, deliveryAddress.pin].filter(Boolean).join(', ')}
                </p>
                <p>{deliveryAddress.contactName} · {deliveryAddress.contactPhone}</p>
                <div className="address-card__actions">
                  <Button variant="outline" to="/account?tab=addresses">Change address</Button>
                </div>
              </article>
            ) : (
              <EmptyState
                title="Add a delivery address"
                message={hasPricingPoint(pricingPoint)
                  ? 'Quick location is set in the header, but checkout needs a saved address with name and phone.'
                  : 'Add an address with a map pin, or set Deliver to in the header.'}
                action={<Button to="/addresses/new" state={{ from: returnFrom }}>Add address</Button>}
              />
            )}
            {!hasPricingPoint(pricingPoint) ? (
              <p className="cart-note" role="status">
                Set <strong>Deliver to</strong> in the header (saved address, GPS, or PIN) so we can check delivery and open payment.
              </p>
            ) : null}
            {authReady && !account ? (
              <div className="form-alert">
                Sign in to pay for this order.
                {' '}
                <Button variant="outline" to="/login" state={{ from: returnFrom }}>Sign in</Button>
              </div>
            ) : null}
            <TextField id="checkout-notes" name="notes" label="Delivery note" hint="Optional. A gate code helps the drop." multiline value={notes} onChange={(event) => setNotes(event.target.value)} />
            <Button type="submit" disabled={busy || quoteBusy || !canPay}>
              {busy
                ? 'Processing…'
                : !acceptingWebsiteOrders
                  ? 'Store is closed'
                  : `Pay ${formatPrice(quote.payable)}`}
            </Button>
            {!canPay && quote.payable > 0 ? (
              <p className="summary__note" role="status">
                {!acceptingWebsiteOrders
                  ? 'The store is closed. Try again when we open checkout.'
                  : !deliveryAddress?.id
                    ? 'Add a saved delivery address to pay.'
                    : !quote.serviceable
                      ? (quote.serviceability?.message || 'This order cannot be delivered to the current location.')
                      : 'Complete the steps above to pay.'}
              </p>
            ) : null}
          </form>
          <aside className="summary">
            <h2>Your order</h2>
            <ul className="summary__items">
              {lines.map((line) => (
                <li key={line.key}>
                  <span>{line.name} × {line.qty}</span>
                  <span>{formatPrice(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {quoteStatus === 'error' && !checkoutQuote ? (
              <p className="cart-note" role="alert">{quoteError}</p>
            ) : (
              <CartTotals quote={quote} />
            )}
            <p>{quote.serviceability.message}</p>
            <p className="summary__note">Coupon {coupon ? `"${coupon}"` : 'not applied'} is included in these totals.</p>
          </aside>
        </div>
      </div>
    </section>
  )
}
