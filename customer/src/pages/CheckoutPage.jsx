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
  fetchDeliverySlots,
  fetchStoreHours,
  payWithRazorpay,
  placeQuickOrder,
  verifyQuickPayment,
} from '../api/checkoutApi.js'
import { useShop } from '../context/shopContext.js'
import { formatPrice } from '../data/catalog.js'

function cartPayload(items, coupon, pricingPoint, subscriptionSchedule, customerId) {
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
    subscriptionSchedule,
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
    defaultAddress,
    pricingPoint,
    quote: shopQuote,
    quoteStatus,
    quoteError,
    setQty,
    clearCoupon,
  } = useShop()
  const [values, setValues] = useState({
    subscriptionSchedule: 'morning',
    slotKey: '',
    slotDate: '',
    deliveryType: '',
    notes: '',
  })
  const [checkoutQuote, setCheckoutQuote] = useState(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [slots, setSlots] = useState([])
  const [slotStatus, setSlotStatus] = useState('idle')
  const [slotMessage, setSlotMessage] = useState('')
  const [storeHours, setStoreHours] = useState({ open: '06:00', close: '20:00' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const quickItems = useMemo(
    () => items.filter((item) => item.deliveryMode !== 'subscription'),
    [items],
  )
  const quote = checkoutQuote || shopQuote
  const lines = quote.items.filter((line) => line.ok)
  useEffect(() => {
    if (items.some((item) => item.deliveryMode === 'subscription') && quickItems.length === 0) {
      navigate('/subscriptions', { replace: true })
    }
  }, [items, quickItems.length, navigate])

  useEffect(() => {
    if (!defaultAddress || quickItems.length === 0) {
      setCheckoutQuote(null)
      return undefined
    }
    let cancel = false
    setQuoteBusy(true)
    const timer = setTimeout(() => {
      quoteCart(cartPayload(quickItems, coupon, pricingPoint, values.subscriptionSchedule, account?.id)).then((next) => {
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
  }, [quickItems, coupon, pricingPoint, values.subscriptionSchedule, account?.id])

  useEffect(() => {
    let cancel = false
    fetchStoreHours()
      .then((result) => {
        const hours = result?.hours
        if (cancel || !hours?.open || !hours?.close) return
        setStoreHours({ open: hours.open, close: hours.close })
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (quickItems.length === 0) {
      setSlots([])
      setSlotStatus('idle')
      return undefined
    }
    let cancel = false
    setSlotStatus('loading')
    const timer = setTimeout(() => {
      fetchDeliverySlots({
        latitude: pricingPoint.latitude,
        longitude: pricingPoint.longitude,
        pin: pricingPoint.pin,
        coupon,
        customerId: account?.id,
        subscriptionSchedule: values.subscriptionSchedule,
        items: quickItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          deliveryMode: 'quick',
        })),
      }).then((result) => {
        if (cancel) return
        setSlotMessage(result.message || '')
        if (result.operatingHours?.open && result.operatingHours?.close) {
          setStoreHours({ open: result.operatingHours.open, close: result.operatingHours.close })
        }
        const next = result.slots || []
        setSlots(next)
        setSlotStatus(next.length ? 'ready' : 'empty')
        const first = next[0]
        if (first) {
          setValues((current) => ({
            ...current,
            slotKey: first.key,
            slotDate: first.date,
            deliveryType: first.deliveryType || 'express',
          }))
        } else {
          setValues((current) => ({ ...current, slotKey: '', slotDate: '', deliveryType: '' }))
        }
      }).catch((reason) => {
        if (cancel) return
        setSlots([])
        setSlotStatus('error')
        setSlotMessage(reason instanceof CheckoutError ? reason.message : 'Delivery options could not be loaded.')
      })
    }, 200)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [quickItems, coupon, pricingPoint, values.subscriptionSchedule, account?.id])

  const windowGroups = useMemo(() => groupWindows(slots), [slots])
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.key === values.slotKey && slot.date === values.slotDate),
    [slots, values.slotKey, values.slotDate],
  )

  function updateNotes(event) {
    setValues((current) => ({ ...current, notes: event.target.value }))
  }

  function pickSlot(slot) {
    setValues((current) => ({
      ...current,
      slotKey: slot.key,
      slotDate: slot.date,
      deliveryType: slot.deliveryType || 'express',
    }))
  }

  async function pay(event) {
    event.preventDefault()
    const next = {}
    if (!account) next.auth = 'Sign in to place this order.'
    if (!defaultAddress) next.address = 'Add a delivery address before checkout.'
    if (quoteStatus === 'error' && !checkoutQuote) next.cart = quoteError
    if (!quote.serviceable) next.cart = quote.serviceability.message || 'Update the cart before checkout.'
    if (!values.slotKey || !values.slotDate || !values.deliveryType) {
      next.slot = slotMessage || 'Choose an available delivery window.'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const placed = await placeQuickOrder({
        addressId: defaultAddress.id,
        deliveryType: values.deliveryType,
        subscriptionSchedule: '',
        slotKey: values.slotKey,
        slotDate: values.slotDate,
        notes: values.notes,
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
          contact: defaultAddress.contactPhone,
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

  const canPay = Boolean(selectedSlot) && quote.serviceable

  return (
    <section className="section section--last">
      <DocumentTitle title="Checkout" />
      <div className="container">
        <div className="page-intro">
          <p className="eyebrow">Quick delivery</p>
          <h1>Checkout</h1>
          <p>Pick an open delivery window. One-time orders follow store hours ({storeHours.open}–{storeHours.close} IST).</p>
        </div>
        <div className="checkout">
          <form className="panel" onSubmit={pay} noValidate>
            {errors.form || errors.auth || errors.address || errors.cart ? (
              <div className="form-alert" role="alert">
                {errors.form || errors.auth || errors.address || errors.cart || 'Please check the highlighted fields.'}
              </div>
            ) : null}
            {defaultAddress ? (
              <article className="address-card address-card--default">
                <p className="eyebrow">Delivery address</p>
                <h2>{defaultAddress.line1}</h2>
                <p>
                  {[defaultAddress.line2, defaultAddress.landmark, defaultAddress.city, defaultAddress.state, defaultAddress.pin].filter(Boolean).join(', ')}
                </p>
                <p>{defaultAddress.contactName} · {defaultAddress.contactPhone}</p>
                <div className="address-card__actions">
                  <Button variant="outline" to="/addresses">Change address</Button>
                </div>
              </article>
            ) : (
              <EmptyState
                title="Add a delivery address"
                message="Add the address this order should go to."
                action={<Button to="/addresses/new" state={{ from: returnFrom }}>Add address</Button>}
              />
            )}
            {authReady && !account ? (
              <div className="form-alert">
                Sign in to pay for this order. The delivery windows below are open now.
                {' '}
                <Button variant="outline" to="/login" state={{ from: returnFrom }}>Sign in</Button>
              </div>
            ) : null}
            <div className="slot-list">
              <h2>Delivery window</h2>
              {slotStatus === 'loading' ? <p role="status">Checking open windows…</p> : null}
              {slotStatus !== 'loading' && slots.length === 0 ? (
                <p className="cart-note" role="status">{slotMessage || 'No delivery windows are open right now.'}</p>
              ) : null}
              {slotStatus !== 'loading' && slots.length > 0 && slotMessage ? (
                <p className="cart-note">{slotMessage}</p>
              ) : null}
              {errors.slot ? <p className="field__error" role="alert">{errors.slot}</p> : null}
              {windowGroups.map((group) => (
                <div key={group.date} className="slot-day">
                  <p className="slot-day__label">{windowDateLabel(group.date)}</p>
                  <ul className="slot-list__items">
                    {group.slots.map((slot) => (
                      <li key={`${slot.key}:${slot.date}`}>
                        <button
                          type="button"
                          className={values.slotKey === slot.key && values.slotDate === slot.date ? 'slot-card slot-card--active' : 'slot-card'}
                          onClick={() => pickSlot(slot)}
                        >
                          <strong>{slot.label}</strong>
                          <span>{windowKind(slot.deliveryType)}</span>
                          {slot.etaMinutes ? <span>ETA ~{slot.etaMinutes} min</span> : null}
                          {slot.remaining != null ? <span>{slot.remaining} spots left</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <TextField id="checkout-notes" name="notes" label="Delivery note" hint="Optional. A gate code helps the drop." multiline value={values.notes} onChange={updateNotes} />
            <Button type="submit" disabled={busy || quoteBusy || !defaultAddress || !canPay}>
              {busy ? 'Processing…' : `Pay ${formatPrice(quote.payable)}`}
            </Button>
            {!canPay && quote.payable > 0 ? (
              <p className="summary__note">
                Pick an open delivery window to continue to payment.
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

function groupWindows(slots) {
  const groups = []
  const index = new Map()
  slots.forEach((slot) => {
    const date = slot.date || ''
    if (!index.has(date)) {
      index.set(date, groups.length)
      groups.push({ date, slots: [] })
    }
    groups[index.get(date)].slots.push(slot)
  })
  return groups
}

function windowDateLabel(date) {
  const today = new Date()
  const key = dateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (date === key) return 'Today'
  if (date === dateKey(tomorrow)) return 'Tomorrow'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function dateKey(value) {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

function windowKind(type) {
  if (type === 'express') return 'Express'
  if (type === 'same-day') return 'Same day'
  if (type === 'scheduled') return 'Scheduled'
  return 'Delivery window'
}
