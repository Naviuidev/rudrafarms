import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import CartTotals from '../components/CartTotals.jsx'
import QuantityStepper from '../components/QuantityStepper.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useShop } from '../context/shopContext.js'
import { useWebsiteOrdersGate } from '../hooks/useWebsiteOrdersGate.js'
import { formatPrice, variantLabel } from '../data/catalog.js'

const MIXED_CART_MESSAGE = 'Quick delivery and subscription items need separate checkouts.'

export default function CartPage() {
  const place = useLocation()
  const {
    items,
    setQty,
    coupon,
    applyCoupon,
    clearCoupon,
    quote,
    quoteStatus,
    quoteError,
    defaultAddress,
  } = useShop()
  const { findProduct } = useCatalog()
  const [code, setCode] = useState(coupon)
  const [mixedPromptOpen, setMixedPromptOpen] = useState(false)
  const acceptingWebsiteOrders = useWebsiteOrdersGate()
  const quoted = Object.fromEntries(quote.items.map((line) => [line.key, line]))
  const quickItems = items.filter((item) => item.deliveryMode !== 'subscription')
  const mixedCart = quote.orderKind === 'mixed'

  useEffect(() => {
    if (mixedCart && quoteStatus === 'ready') {
      setMixedPromptOpen(true)
    }
    if (!mixedCart) {
      setMixedPromptOpen(false)
    }
  }, [mixedCart, quoteStatus])

  function removeMixedItem(key) {
    setQty(key, 0)
  }

  function itemPresentation(item) {
    const line = quoted[item.key]
    const product = findProduct(item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    const name = product?.name || (line?.name !== 'Cart item' ? line?.name : 'Product')
    const image = line?.image || product?.image || ''
    const unit = line?.unit || variantLabel(variant)
    const mode = item.deliveryMode === 'subscription' ? 'subscription' : 'quick'
    return { name, image, unit, mode }
  }

  return (
    <section className="section account-page">
      <DocumentTitle title="Cart" />
      <div className="container">
        <header className="account-head">
          <h1>Cart</h1>
          <p className="subs-muted">Prices and stock are checked before checkout.</p>
        </header>
        {items.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            message="Add milk, vegetables, or a pantry staple and it will wait here until checkout."
            action={<Button to="/shop">Browse products</Button>}
          />
        ) : (
          <div className="cart-layout">
            <ul className="cart-list">
              {items.map((item) => {
                const line = quoted[item.key]
                return (
                  <li key={item.key} className="cart-line">
                    {line?.image ? <img src={line.image} alt="" width="96" height="96" /> : <span className="cart-line__placeholder" />}
                    <div>
                      <h2>
                        {line ? <Link to={`/product/${item.productId}`}>{line.name}</Link> : 'Checking this item'}
                      </h2>
                      {line ? <p>{line.unit} · {formatPrice(line.price)}</p> : <p role="status">Checking the price…</p>}
                      {line?.message ? <p className="cart-note" role="status">{line.message}</p> : null}
                      <button type="button" className="text-button" onClick={() => setQty(item.key, 0)}>
                        Remove
                      </button>
                    </div>
                    <QuantityStepper
                      value={item.qty}
                      min={1}
                      max={line?.stock > 0 ? line.stock : 12}
                      label={`${line?.name || 'Item'} quantity`}
                      onChange={(qty) => setQty(item.key, qty)}
                    />
                    <strong>
                      {line?.price > 0 ? formatPrice(line.price * item.qty) : '—'}
                    </strong>
                  </li>
                )
              })}
            </ul>
            <aside className="summary">
              <h2>Order summary</h2>
              {quoteStatus === 'error' ? <p className="cart-note" role="alert">{quoteError}</p> : null}
              {quoteStatus === 'loading' && quote.items.length === 0 ? <p role="status">Checking the cart…</p> : <CartTotals quote={quote} />}
              <form
                className="coupon-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  applyCoupon(code)
                }}
              >
                <TextField id="cart-coupon" label="Coupon" value={code} onChange={(event) => setCode(event.target.value)} placeholder="FARM10" />
                <Button type="submit">Apply</Button>
              </form>
              {quote.coupon.message ? (
                <p className={quote.coupon.applied ? 'summary__note' : 'cart-note'} role="status">{quote.coupon.message}</p>
              ) : null}
              {coupon ? (
                <button type="button" className="text-button" onClick={() => { clearCoupon(); setCode('') }}>
                  Remove coupon
                </button>
              ) : null}
              {(() => {
                const storeClosed = !acceptingWebsiteOrders && quickItems.length > 0
                const deliveryNote = storeClosed
                  ? 'The store is closed. You can still review your cart; payment opens when checkout is on.'
                  : !quote.serviceable && quote.serviceability?.message && !mixedCart
                    ? quote.serviceability.message
                    : !defaultAddress && quickItems.length > 0
                      ? 'Add a delivery address before checkout.'
                      : ''
                return deliveryNote ? <p className={!quote.serviceable && quote.serviceability?.message ? 'cart-note' : undefined} role={!quote.serviceable ? 'alert' : 'status'}>{deliveryNote}</p> : null
              })()}
              {defaultAddress && quickItems.length > 0 && !acceptingWebsiteOrders ? (
                <Button type="button" disabled>Store is closed</Button>
              ) : (
                <Button
                  to={defaultAddress ? '/checkout' : '/addresses/new'}
                  state={defaultAddress ? undefined : { from: `${place.pathname}${place.search}` }}
                  disabled={mixedCart}
                >
                  {defaultAddress ? 'Continue to checkout' : 'Add a delivery address'}
                </Button>
              )}
            </aside>
          </div>
        )}
      </div>

      <Dialog
        open={mixedPromptOpen}
        title="Separate checkouts"
        className="dialog--cart-mixed"
        onClose={() => setMixedPromptOpen(false)}
      >
        <p className="area-prompt__copy">{MIXED_CART_MESSAGE}</p>
        <p className="subs-muted">Remove one item below to continue checkout here, or use Subscriptions for subscription products.</p>
        <ul className="cart-mixed-list" aria-label="Cart items">
          {items.map((item) => {
            const { name, image, unit, mode } = itemPresentation(item)
            return (
              <li key={item.key} className="cart-mixed-card">
                <button
                  type="button"
                  className="cart-mixed-card__remove"
                  aria-label={`Remove ${name} from cart`}
                  onClick={() => removeMixedItem(item.key)}
                >
                  ×
                </button>
                <div className="cart-mixed-card__media">
                  {image ? <img src={image} alt="" width="72" height="72" /> : <span className="cart-line__placeholder" />}
                </div>
                <div className="cart-mixed-card__body">
                  <span className={`cart-mixed-card__tag cart-mixed-card__tag--${mode}`}>
                    {mode === 'subscription' ? 'Subscription' : 'Quick delivery'}
                  </span>
                  <strong>{name}</strong>
                  {unit ? <p>{unit} · Qty {item.qty}</p> : <p>Qty {item.qty}</p>}
                </div>
              </li>
            )
          })}
        </ul>
        <div className="dialog-form">
          <Button type="button" onClick={() => setMixedPromptOpen(false)}>OK</Button>
          <Button type="button" variant="outline" to="/subscriptions">Subscriptions</Button>
        </div>
      </Dialog>
    </section>
  )
}
