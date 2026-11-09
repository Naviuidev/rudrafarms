import { useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from '@brand/components/Skeleton.jsx'
import { useToast } from '@brand/toastContext.js'
import { useShop } from '../context/shopContext.js'
import { formatPrice } from '../data/catalog.js'
import QuantityStepper from './QuantityStepper.jsx'
import './ProductCard.css'

export default function ProductCard({ product, onAdd, qty = 0, maxQty = 12, onQty, note = '', onSelect }) {
  const [loadedSrc, setLoadedSrc] = useState('')
  const [savingWish, setSavingWish] = useState(false)
  const { wishlist, toggleWishlist } = useShop()
  const showToast = useToast()
  const loaded = loadedSrc === product.image
  const saved = wishlist.includes(product.id)
  const purchasable = product.available && product.stock > 0

  async function onWish() {
    setSavingWish(true)
    try {
      const next = await toggleWishlist(product.id)
      showToast({
        title: next ? 'Saved to wishlist' : 'Removed from wishlist',
        message: product.name,
      })
    } catch (reason) {
      showToast({
        title: 'Wishlist',
        message: reason instanceof Error ? reason.message : 'The wishlist could not be updated.',
      })
    } finally {
      setSavingWish(false)
    }
  }

  return (
    <article
      className={onSelect ? 'product-card product-card--selectable' : 'product-card'}
      onClick={onSelect ? () => onSelect(product) : undefined}
    >
      <div className="product-card__media">
        {onSelect ? (
          <button type="button" className="product-card__open" aria-label={`Select ${product.name}`} onClick={() => onSelect(product)}>
            {loaded ? null : <Skeleton className="product-card__skeleton" />}
            {product.image ? (
              <img
                src={product.image}
                alt=""
                width="640"
                height="640"
                loading="lazy"
                onLoad={() => setLoadedSrc(product.image)}
              />
            ) : null}
          </button>
        ) : (
          <Link to={`/product/${product.id}`} aria-label={`View ${product.name}`}>
            {loaded ? null : <Skeleton className="product-card__skeleton" />}
            {product.image ? (
              <img
                src={product.image}
                alt=""
                width="640"
                height="640"
                loading="lazy"
                onLoad={() => setLoadedSrc(product.image)}
              />
            ) : null}
          </Link>
        )}
      </div>
      <div className="product-card__body">
        <p className="product-card__unit">{product.unit}</p>
        <h3>
          {onSelect ? (
            <button type="button" className="product-card__name" onClick={() => onSelect(product)}>{product.name}</button>
          ) : (
            <Link to={`/product/${product.id}`}>{product.name}</Link>
          )}
        </h3>
        <p className="product-card__price">
          <strong>{formatPrice(product.price)}</strong>
          {product.discount > 0 ? <s>{formatPrice(product.mrp)}</s> : null}
          {product.discountPercent > 0 ? <span className="product-card__off">{product.discountPercent}% off</span> : null}
        </p>
        {note ? <p className="product-card__note">{note}</p> : null}
      </div>
      <div className="product-card__actions">
        <button
          type="button"
          className={saved ? 'product-card__wish product-card__wish--saved' : 'product-card__wish'}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          disabled={savingWish}
          onClick={(event) => {
            event.stopPropagation()
            onWish()
          }}
        >
          <HeartGlyph filled={saved} />
        </button>
        {onQty ? (
          <QuantityStepper
            className="stepper--card"
            value={qty}
            min={0}
            max={Math.max(qty, maxQty)}
            label={`${product.name} quantity`}
            onChange={onQty}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="product-card__add"
            disabled={!purchasable}
            onClick={(event) => {
              event.stopPropagation()
              onAdd(product)
            }}
          >
            <span className="product-card__add-label">{purchasable ? 'ADD' : 'Out'}</span>
            <CartGlyph />
          </button>
        )}
      </div>
    </article>
  )
}

function CartGlyph() {
  return (
    <svg className="product-card__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM6.2 6l.4 2h12.7l-1.4 7H8.1L6.2 6zM5 4H2V2h3.2l.5 2H21l-2.2 10H7.2L5 4z" />
    </svg>
  )
}

function HeartGlyph({ filled }) {
  return (
    <svg className="product-card__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.75}
        d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"
      />
    </svg>
  )
}
