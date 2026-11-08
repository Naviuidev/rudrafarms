import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { SkeletonCard } from '@brand/components/Skeleton.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { checkServiceability } from '../api/locationApi.js'
import {
  SubscriptionApiError,
  fetchSubscriptionCatalog,
  quoteSubscription,
  startSubscription,
} from '../api/subscriptionApi.js'
import { payWithRazorpay, verifyQuickPayment } from '../api/checkoutApi.js'
import ProductCard from '../components/ProductCard.jsx'
import ServiceabilityStatus from '../components/ServiceabilityStatus.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useShop } from '../context/shopContext.js'
import { formatPrice } from '../data/catalog.js'
import { useServiceCheck } from '../useServiceCheck.js'

function todayIso() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export default function SubscriptionsPage() {
  const { account, authReady, defaultAddress } = useShop()
  const { status: catalogStatus, products } = useCatalog()
  const subscriptionProducts = products.filter((product) => product.subscription && product.available && product.stock > 0)
  const [params] = useSearchParams()
  const place = useLocation()
  const preselect = params.get('product')

  const [paymentSandbox, setPaymentSandbox] = useState(false)
  const [plans, setPlans] = useState([])
  const [schedules, setSchedules] = useState([])
  const [mySubscriptions, setMySubscriptions] = useState([])
  const [loadError, setLoadError] = useState('')

  const [mode, setMode] = useState(preselect ? 'custom' : 'plan')
  const [planId, setPlanId] = useState('')
  const [chosenId, setChosenId] = useState(preselect || '')
  const [qty, setQty] = useState({})
  const [scheduleKey, setScheduleKey] = useState('morning')
  const [startDate, setStartDate] = useState(todayIso)

  const [quote, setQuote] = useState(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [subCoupon, setSubCoupon] = useState('')

  const [payBusy, setPayBusy] = useState(false)
  const [payError, setPayError] = useState('')

  const { service, checking, error: checkError } = useServiceCheck(defaultAddress, 'subscription')
  const outsideArea = Boolean(service && !service.subscription)

  const quantityFor = (id) => {
    if (id !== chosenId) return 0
    if (Object.hasOwn(qty, id)) return qty[id]
    return 1
  }

  const customLines = useMemo(() => {
    const lines = []
    for (const product of subscriptionProducts) {
      const q = quantityFor(product.id)
      if (q < 1) continue
      const variant = product.variants?.find((entry) => entry.isDefault) || product.variants?.[0]
      if (!variant) continue
      lines.push({ productId: product.id, variantId: variant.id, dailyQty: q })
    }
    return lines
  }, [subscriptionProducts, qty, chosenId])

  const picked = customLines.length > 0
  const planRef = useRef(null)
  const wasPicked = useRef(false)

  useEffect(() => {
    if (!picked) {
      wasPicked.current = false
      return undefined
    }
    if (wasPicked.current) return undefined
    const frame = requestAnimationFrame(() => {
      const node = planRef.current
      if (!node) return
      wasPicked.current = true
      const chrome = document.querySelector('.chrome')
      const offset = (chrome?.getBoundingClientRect().height ?? 0) + 16
      const top = window.scrollY + node.getBoundingClientRect().top - offset
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [picked])

  const loadCatalog = useCallback(() => {
    if (!account) return
    setLoadError('')
    fetchSubscriptionCatalog()
      .then((data) => {
        const offered = (data.plans || []).filter((plan) => !/family dairy/i.test(plan.name || ''))
        setPlans(offered)
        setSchedules(data.schedules || [])
        setMySubscriptions(data.subscriptions || [])
        setPaymentSandbox(Boolean(data.paymentSandbox))
        if (offered[0]?.id) setPlanId((current) => current || offered[0].id)
      })
      .catch((reason) => {
        setLoadError(reason instanceof SubscriptionApiError ? reason.message : 'Could not load subscriptions.')
      })
  }, [account])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  function selectProduct(product) {
    setMode('custom')
    setChosenId(product.id)
    setQty((current) => ({ ...current, [product.id]: current[product.id] > 0 ? current[product.id] : 1 }))
    setQuote(null)
  }

  function setDailyQty(productId, next) {
    if (next < 1) {
      setChosenId('')
      setQuote(null)
      return
    }
    setMode('custom')
    setChosenId(productId)
    setQty((current) => ({ ...current, [productId]: next }))
    setQuote(null)
  }

  function clearPick() {
    setChosenId('')
    setQuote(null)
  }

  function applyPlan(selected) {
    setMode('plan')
    setPlanId(selected.id)
    setQuote(null)
    setQuoteError('')
  }

  function variantFor(product) {
    return product.variants?.find((entry) => entry.isDefault) || product.variants?.[0]
  }

  async function runQuote() {
    setQuoteError('')
    setQuote(null)
    if (!defaultAddress) {
      setQuoteError('Add a delivery address first.')
      return
    }
    if (mode === 'plan' && !planId) {
      setQuoteError('Choose a plan first.')
      return
    }
    if (mode === 'custom' && customLines.length === 0) {
      setQuoteError('Add at least one product to the daily basket.')
      return
    }
    try {
      const fresh = await checkServiceability(defaultAddress, 'subscription')
      if (!fresh.subscription) {
        setQuoteError('Subscription delivery is not available for this address.')
        return
      }
    } catch (reason) {
      setQuoteError(reason instanceof Error ? reason.message : 'Service check failed.')
      return
    }

    setQuoteBusy(true)
    try {
      const body = {
        addressId: defaultAddress.id,
        scheduleKey,
        startDate,
      }
      if (subCoupon.trim()) {
        body.coupon = subCoupon.trim()
      }
      if (mode === 'plan' && planId) {
        body.planId = planId
      } else {
        body.lines = customLines
      }
      const result = await quoteSubscription(body)
      setQuote(result)
    } catch (reason) {
      setQuoteError(reason instanceof SubscriptionApiError ? reason.message : 'Quote failed.')
    } finally {
      setQuoteBusy(false)
    }
  }

  async function pay() {
    setPayError('')
    if (!quote || !defaultAddress || !account) {
      setPayError('Get a quote first.')
      return
    }
    setPayBusy(true)
    try {
      const body = {
        addressId: defaultAddress.id,
        scheduleKey,
        startDate,
      }
      if (subCoupon.trim()) {
        body.coupon = subCoupon.trim()
      }
      if (mode === 'plan' && planId) {
        body.planId = planId
      } else {
        body.lines = customLines
      }
      const placed = await startSubscription(body)
      const orderId = placed.order?.id
      const payment = placed.razorpay
      if (!orderId || !payment) {
        throw new SubscriptionApiError('Could not start payment.')
      }

      if (payment.mock) {
        await verifyQuickPayment({ orderId, mock: true })
        await loadCatalog()
        window.location.href = `/orders/${orderId}?confirmed=1`
        return
      }

      await payWithRazorpay({
        payment,
        orderId,
        description: `Subscription · ${placed.order?.orderNumber || ''}`,
        prefill: {
          name: account.name,
          email: account.email,
          contact: defaultAddress.contactPhone,
        },
      })
      await loadCatalog()
      window.location.href = `/orders/${orderId}?confirmed=1`
    } catch (reason) {
      setPayError(reason instanceof Error ? reason.message : 'Payment could not be completed.')
    } finally {
      setPayBusy(false)
    }
  }

  const addressPrompt = !picked
    ? null
    : !defaultAddress
      ? { message: 'Add a delivery address to process this plan.' }
      : checking
        ? { message: 'Checking whether this address is inside a subscription delivery area.' }
        : (outsideArea || checkError)
          ? { message: 'This address is outside the subscription area. Add an address in a delivery location.' }
          : null

  if (!authReady) {
    return (
      <section className="section subs-page">
        <DocumentTitle title="Subscriptions" />
        <div className="container"><p className="subs-muted" role="status">Loading…</p></div>
      </section>
    )
  }

  return (
    <section className="section subs-page">
      <DocumentTitle title="Subscriptions" />
      {addressPrompt ? createPortal(
        <div className="address-pop" role="status">
          <p>{addressPrompt.message}</p>
          {defaultAddress && checking ? null : (
            <Link to="/addresses/new" state={{ from: `${place.pathname}${place.search}` }}>Add address</Link>
          )}
        </div>,
        document.body,
      ) : null}
      <div className="container">
        <header className="account-head">
          <h1>Subscriptions</h1>
          <p className="subs-muted">Tap a product to select it. The other products close, then choose the plan and billing.</p>
        </header>

        {loadError ? <p className="field__error" role="alert">{loadError}</p> : null}

        <section className="rail-block" aria-label="Subscription products">
          <div className="rail-block__head">
            <h2>{picked ? 'Selected product' : 'Subscription products'}</h2>
            {picked ? (
              <button type="button" className="subs-change" onClick={clearPick}>Change product</button>
            ) : null}
          </div>
          {catalogStatus === 'loading' ? (
            <div className="rail" aria-busy="true">
              <p className="sr-only">Loading products</p>
              {Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)}
            </div>
          ) : null}
          {catalogStatus === 'ready' && subscriptionProducts.length === 0 ? (
            <p className="subs-muted">No subscription products are available right now.</p>
          ) : null}
          {catalogStatus === 'ready' && subscriptionProducts.length > 0 ? (
            <div className="rail">
              {(subscriptionProducts.some((product) => product.id === chosenId)
                ? subscriptionProducts.filter((product) => product.id === chosenId)
                : subscriptionProducts
              ).map((product) => {
                const selected = quantityFor(product.id)
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    qty={selected}
                    maxQty={12}
                    note={selected > 0 ? `${selected} per day` : ''}
                    onSelect={selectProduct}
                    onAdd={() => selectProduct(product)}
                    onQty={selected > 0 ? (next) => setDailyQty(product.id, next) : undefined}
                  />
                )
              })}
            </div>
          ) : null}
        </section>

        {mySubscriptions.filter((sub) => sub.status !== 'cancelled' && sub.status !== 'pending_payment').length > 0 ? (
          <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <h2 className="subs-label">Your subscriptions</h2>
            <ul className="subs-list">
              {mySubscriptions.filter((sub) => sub.status !== 'cancelled' && sub.status !== 'pending_payment').map((sub) => (
                <li key={sub.id} className="subs-row subs-row--manage">
                  <div>
                    <strong>{sub.statusLabel}</strong>
                    <p className="subs-muted">Started {sub.startDate} · {sub.scheduleKey} drop</p>
                  </div>
                  <Button variant="outline" to={`/subscriptions/${sub.id}`}>Manage</Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {picked ? <div className="builder subs-layout">
          <div className="subs-basket" ref={planRef}>
            <p className="subs-label">Plan type</p>
            <div className="subs-duration" role="group" aria-label="Plan mode">
              <button
                type="button"
                className={mode === 'plan' ? 'subs-duration__btn subs-duration__btn--active' : 'subs-duration__btn'}
                onClick={() => { setMode('plan'); setQuote(null) }}
              >
                Fixed plan
              </button>
              <button
                type="button"
                className={mode === 'custom' ? 'subs-duration__btn subs-duration__btn--active' : 'subs-duration__btn'}
                onClick={() => { setMode('custom'); setQuote(null) }}
              >
                Custom basket
              </button>
            </div>

            {mode === 'plan' ? (
              plans.length === 0 ? (
                <p className="subs-muted">No plans are available right now. Build a custom basket instead.</p>
              ) : (
                <ul className="subs-list">
                  {plans.map((plan) => (
                    <li key={plan.id} className="subs-row subs-row--choice">
                      <label>
                        <input
                          type="radio"
                          name="subplan"
                          checked={planId === plan.id}
                          onChange={() => applyPlan(plan)}
                        />
                        <span className="subs-row__meta">
                          <span className="subs-row__name">{plan.name}</span>
                          <span className="subs-row__unit">{plan.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="subs-muted">
                {customLines.length
                  ? `${customLines.length} ${customLines.length === 1 ? 'product' : 'products'} in the daily basket.`
                  : 'Tap ADD on a subscription product above to include it.'}
              </p>
            )}

            <fieldset className="subs-drop">
              <legend className="subs-label">Daily drop</legend>
              <div className="choices subs-choices">
                {schedules.map((sch) => (
                  <label key={sch.key} className="choice">
                    <input
                      type="radio"
                      name="subSchedule"
                      value={sch.key}
                      checked={scheduleKey === sch.key}
                      onChange={() => { setScheduleKey(sch.key); setQuote(null) }}
                    />
                    <strong>{sch.label}</strong>
                    <span>{sch.detail}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="subs-fields">
              <TextField
                id="sub-start"
                label="Subscription starts"
                type="date"
                value={startDate}
                min={todayIso()}
                onChange={(event) => { setStartDate(event.target.value); setQuote(null) }}
              />
              <TextField
                id="sub-coupon"
                label="Coupon"
                value={subCoupon}
                onChange={(event) => { setSubCoupon(event.target.value); setQuote(null) }}
                placeholder="Optional"
                autoComplete="off"
              />
            </div>
          </div>

          <aside className="summary sub-summary">
            <h2 className="sub-summary__title">Billing</h2>
            <p className="subs-muted subs-muted--small">
              Amount covers every calendar day in the first month from your start date, at your per-day quantities (Sundays included). Pauses and skips can adjust later cycles.
            </p>

            {account && defaultAddress ? (
              <article className="address-card sub-address">
                <p className="subs-label">Deliver to</p>
                <h3>{defaultAddress.line1}</h3>
                <p className="subs-muted">{defaultAddress.city} {defaultAddress.pin}</p>
                <ServiceabilityStatus service={service} checking={checking} error={checkError} />
              </article>
            ) : (
              <p className="subs-muted">{account ? 'Add a delivery address to continue.' : 'Sign in to choose an address and pay for the first month.'}</p>
            )}

            {quote ? (
              <div className="sub-bill">
                <div className="sub-bill__row">
                  <span>Billable delivery days</span>
                  <strong>{quote.billableDeliveryDays}</strong>
                </div>
                <div className="sub-bill__row">
                  <span>Period</span>
                  <strong>{quote.periodStart} → {quote.periodEnd}</strong>
                </div>
                {quote.grossSubtotal != null && quote.grossSubtotal !== quote.subtotal ? (
                  <>
                    <div className="sub-bill__row">
                      <span>Subtotal</span>
                      <strong>{formatPrice(quote.grossSubtotal)}</strong>
                    </div>
                    <div className="sub-bill__row">
                      <span>Discount</span>
                      <strong>−{formatPrice(quote.discount ?? 0)}</strong>
                    </div>
                  </>
                ) : null}
                {quote.coupon?.message ? (
                  <p className="subs-muted subs-muted--small" role="status">{quote.coupon.message}</p>
                ) : null}
                <div className="sub-bill__row">
                  <span>Due now</span>
                  <strong>{formatPrice(quote.payable)}</strong>
                </div>
              </div>
            ) : null}

            {outsideArea ? <p className="field__error" role="status">This address is outside the subscription area.</p> : null}
            {quoteError ? <p className="field__error" role="alert">{quoteError}</p> : null}
            {payError ? <p className="field__error" role="alert">{payError}</p> : null}

            {!account ? (
              <Button to="/login" state={{ from: '/subscriptions' }}>Sign in to start</Button>
            ) : (
              <>
            <Button className="sub-cta" type="button" onClick={runQuote} disabled={quoteBusy || checking || !defaultAddress || outsideArea}>
              {quoteBusy ? 'Calculating…' : 'Calculate first month'}
            </Button>
            <Button className="sub-cta" type="button" onClick={pay} disabled={payBusy || !quote || !defaultAddress || outsideArea}>
              {payBusy ? 'Waiting for the UPI payment…' : (quote ? `Pay ${formatPrice(quote.payable)}` : 'Pay')}
            </Button>
            {paymentSandbox ? (
              <p className="subs-muted subs-muted--small">
                PhonePe and Google Pay show “Unable to verify the QR code” on this test QR. In the Razorpay window, pay with the UPI ID success@razorpay. A live key under Config payment is what makes a phone scan work.
              </p>
            ) : (
              <p className="subs-muted subs-muted--small">Scan the QR and pay in your UPI app. This page confirms the order after the payment lands, even if the window closes.</p>
            )}
            <Button variant="ghost" to="/addresses">Manage addresses</Button>
            <Link to="/orders" className="subs-muted">Order history</Link>
              </>
            )}
          </aside>
        </div> : null}
      </div>
    </section>
  )
}
