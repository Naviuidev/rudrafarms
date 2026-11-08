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
          <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
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
            onClick={() => onAdd(product)}
          >
            {purchasable ? 'ADD' : 'Out'}
          </button>
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
    </article>
  )
}
