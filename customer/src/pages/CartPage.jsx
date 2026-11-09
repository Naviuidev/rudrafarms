import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import CartTotals from '../components/CartTotals.jsx'
import QuantityStepper from '../components/QuantityStepper.jsx'
import { useShop } from '../context/shopContext.js'
import { useWebsiteOrdersGate } from '../hooks/useWebsiteOrdersGate.js'
import { formatPrice } from '../data/catalog.js'

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
  const [code, setCode] = useState(coupon)
  const acceptingWebsiteOrders = useWebsiteOrdersGate()
  const quoted = Object.fromEntries(quote.items.map((line) => [line.key, line]))
  const quickItems = items.filter((item) => item.deliveryMode !== 'subscription')

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
              <p>
                {!acceptingWebsiteOrders && quickItems.length > 0
                  ? 'The store is closed. You can still review your cart; payment opens when checkout is on.'
                  : (quote.serviceability.message || (defaultAddress ? '' : 'Add a delivery address before checkout.'))}
              </p>
              {defaultAddress && quickItems.length > 0 && !acceptingWebsiteOrders ? (
                <Button type="button" disabled>Store is closed</Button>
              ) : (
                <Button to={defaultAddress ? '/checkout' : '/addresses/new'} state={defaultAddress ? undefined : { from: `${place.pathname}${place.search}` }}>
                  {defaultAddress ? 'Continue to checkout' : 'Add a delivery address'}
                </Button>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
