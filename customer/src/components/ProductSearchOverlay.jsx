import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useCatalog } from '../context/catalogContext.js'
import { formatPrice } from '../data/catalog.js'

function matchProducts(products, term) {
  const needle = term.trim().toLowerCase()
  if (!needle) return []
  return products.filter((product) => {
    const haystack = [
      product.name,
      product.description,
      product.category,
      product.subcategory,
      product.unit,
      ...product.variants.map((variant) => `${variant.unit} ${variant.label}`),
    ].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

export default function ProductSearchOverlay({ open, initialQuery = '', onClose, onCommit }) {
  const navigate = useNavigate()
  const { products, status } = useCatalog()
  const [query, setQuery] = useState(initialQuery)
  const inputRef = useRef(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
  }, [open, initialQuery])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => inputRef.current?.focus())

    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const results = useMemo(() => {
    const ranked = matchProducts(products, query)
    return ranked.slice(0, 24)
  }, [products, query])

  if (!open) return null

  function goToShop() {
    const term = query.trim()
    onCommit?.(term)
    onClose()
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }

  return createPortal(
    <div className="search-overlay" role="presentation">
      <button type="button" className="search-overlay__scrim" aria-label="Close search" onClick={onClose} />
      <div className="search-overlay__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="search-overlay__head">
          <form
            className="search-overlay__form"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              goToShop()
            }}
          >
            <label className="sr-only" htmlFor="product-search-overlay">Search products</label>
            <span className="search-overlay__icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              id="product-search-overlay"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Search for milk, ghee, vegetables…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="search-overlay__clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                ×
              </button>
            ) : null}
          </form>
          <button type="button" className="search-overlay__close" onClick={onClose}>
            Cancel
          </button>
        </div>
        <h2 id={titleId} className="sr-only">Search products</h2>
        <div className="search-overlay__body">
          {status === 'loading' ? (
            <p className="search-overlay__hint" aria-busy="true">Loading products…</p>
          ) : null}
          {status !== 'loading' && query.trim() && results.length === 0 ? (
            <p className="search-overlay__empty">No products match “{query.trim()}”.</p>
          ) : null}
          {status !== 'loading' && !query.trim() ? (
            <p className="search-overlay__hint">Type to find products across the store.</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="search-overlay__list">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    to={`/product/${product.id}`}
                    className="search-overlay__item"
                    onClick={onClose}
                  >
                    <span className="search-overlay__thumb">
                      {product.image ? (
                        <img src={product.image} alt="" width="56" height="56" loading="lazy" />
                      ) : (
                        <span className="search-overlay__thumb-fallback" aria-hidden="true" />
                      )}
                    </span>
                    <span className="search-overlay__meta">
                      <span className="search-overlay__name">{product.name}</span>
                      <span className="search-overlay__sub">
                        {[product.category, product.unit].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="search-overlay__price">{formatPrice(product.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {query.trim() ? (
            <button type="button" className="search-overlay__all" onClick={goToShop}>
              View all results for “{query.trim()}”
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm5-2 4 4" />
    </svg>
  )
}