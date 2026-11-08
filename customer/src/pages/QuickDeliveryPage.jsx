import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { SkeletonCard } from '@brand/components/Skeleton.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useShop } from '../context/shopContext.js'
import { useAddToCart } from '../useAddToCart.js'

const modes = [
  { id: 'express', title: 'Express', copy: 'Fastest slot open now.' },
  { id: 'same-day', title: 'Same day', copy: 'Later today, before close.' },
  { id: 'scheduled', title: 'Scheduled', copy: 'Pick a day and window.' },
]

export default function QuickDeliveryPage() {
  const addToCart = useAddToCart()
  const place = useLocation()
  const { defaultAddress } = useShop()
  const { status, products, error, reload } = useCatalog()
  const [mode, setMode] = useState('same-day')
  const quickProducts = products.filter((product) => product.quickDelivery)

  return (
    <section className="section quick-page">
      <DocumentTitle title="Quick delivery" />
      <div className="container">
        <header className="page-intro page-intro--plain quick-head">
          <h1>Quick delivery</h1>
          <p className="subs-muted">Order once. Pick a slot. No subscription.</p>
        </header>

        <div className="quick-address">
          {defaultAddress ? (
            <>
              <p className="subs-label">Deliver to</p>
              <p className="quick-address__line">{defaultAddress.line1}</p>
              <p className="subs-muted">{defaultAddress.city} {defaultAddress.pin}</p>
            </>
          ) : (
            <>
              <p className="subs-label">Address</p>
              <p className="subs-muted">Add where this order should go.</p>
              <Button className="sub-cta quick-address__btn" to="/addresses/new" state={{ from: `${place.pathname}${place.search}` }}>Add address</Button>
            </>
          )}
        </div>

        <div className="quick-modes" role="radiogroup" aria-label="Delivery speed">
          <p className="subs-label">When</p>
          <div className="quick-mode-scroll">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={mode === item.id ? 'quick-mode-btn quick-mode-btn--active' : 'quick-mode-btn'}
                role="radio"
                aria-checked={mode === item.id}
                onClick={() => setMode(item.id)}
              >
                <strong>{item.title}</strong>
                <span className="quick-mode-btn__hint">{item.copy}</span>
              </button>
            ))}
          </div>
        </div>

        {status === 'error' ? (
          <ErrorState title="Quick delivery is unavailable" message={error} action={<Button onClick={reload}>Try again</Button>} />
        ) : null}

        {status === 'loading' ? (
          <section className="rail-block quick-rail" aria-busy="true">
            <div className="rail-block__head">
              <h2>Available now</h2>
            </div>
            <div className="rail">
              {Array.from({ length: 6 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          </section>
        ) : null}

        {status === 'ready' ? (
          <section className="rail-block quick-rail">
            <div className="rail-block__head">
              <h2>Available now</h2>
              <Button variant="ghost" to="/shop">See all</Button>
            </div>
            {quickProducts.length === 0 ? (
              <p className="subs-muted quick-rail__empty">No quick-delivery products yet.</p>
            ) : (
              <div className="rail">
                {quickProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={addToCart} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </section>
  )
}
