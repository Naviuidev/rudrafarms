import { useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { SkeletonCard } from '@brand/components/Skeleton.jsx'
import { SelectField, TextField } from '@brand/components/TextField.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useAddToCart } from '../useAddToCart.js'

const sorts = [
  ['featured', 'Featured'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['discount', 'Discount'],
  ['name', 'Name'],
]

const filters = [
  ['stock', 'In stock'],
  ['subscription', 'Subscription'],
  ['quick', 'Quick delivery'],
  ['featured', 'Featured'],
]

export default function ShopPage() {
  const addToCart = useAddToCart()
  const { status, categories, products, error, reload } = useCatalog()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || 'All'
  const subcategory = params.get('subcategory') || ''
  const query = params.get('q') || ''
  const sort = params.get('sort') || 'featured'
  const selected = categories.find((item) => item.name === category || item.slug === category)
  const subcategories = selected?.subcategories || []

  const visible = (() => {
    const filtered = products.filter((product) => {
      const matchesCategory = !selected || product.categoryId === selected.id
      const matchesSubcategory = !subcategory || product.subcategory === subcategory
      const matchesStock = params.get('stock') !== '1' || (product.available && product.stock > 0)
      const matchesSubscription = params.get('subscription') !== '1' || product.subscription
      const matchesQuick = params.get('quick') !== '1' || product.quickDelivery
      const matchesFeatured = params.get('featured') !== '1' || product.featured
      const haystack = [
        product.name,
        product.description,
        product.category,
        product.subcategory,
        product.unit,
        ...product.variants.map((variant) => `${variant.unit} ${variant.label}`),
      ].join(' ').toLowerCase()
      const matchesQuery = haystack.includes(query.trim().toLowerCase())
      return matchesCategory && matchesSubcategory && matchesStock && matchesSubscription && matchesQuick && matchesFeatured && matchesQuery
    })
    const ranked = [...filtered]
    if (sort === 'price-asc') ranked.sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') ranked.sort((a, b) => b.price - a.price)
    else if (sort === 'name') ranked.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'discount') ranked.sort((a, b) => b.discountPercent - a.discountPercent || a.name.localeCompare(b.name))
    else ranked.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name))
    return ranked
  })()

  function updateParams(next) {
    const merged = {
      category,
      subcategory,
      q: query,
      sort,
      stock: params.get('stock') || '',
      subscription: params.get('subscription') || '',
      quick: params.get('quick') || '',
      featured: params.get('featured') || '',
      ...next,
    }
    const cleaned = {}
    if (merged.category && merged.category !== 'All') cleaned.category = merged.category
    if (merged.subcategory) cleaned.subcategory = merged.subcategory
    if (merged.q) cleaned.q = merged.q
    if (merged.sort && merged.sort !== 'featured') cleaned.sort = merged.sort
    for (const key of ['stock', 'subscription', 'quick', 'featured']) {
      if (merged[key] === '1') cleaned[key] = '1'
    }
    setParams(cleaned)
  }

  return (
    <section className="section shop-page">
      <DocumentTitle title="Shop" />
      <div className="container">
        {selected ? (
          <header className="shop-head">
            <button
              type="button"
              className="shop-back"
              onClick={() => updateParams({ category: 'All', subcategory: '' })}
              aria-label="Back to all categories"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div className="shop-head__titles">
              <h1 className="shop-head__title">{selected.name}</h1>
              <p className="subs-muted shop-head__hint">Search, sort, or tap ADD on a card.</p>
            </div>
          </header>
        ) : (
          <div className="page-intro page-intro--plain shop-head--home">
            <h1>Shop</h1>
            <p className="subs-muted">Browse by category below.</p>
          </div>
        )}
        {status === 'error' ? (
          <ErrorState title="The shop is unavailable" message={error} action={<Button onClick={reload}>Try again</Button>} />
        ) : null}
        {status === 'loading' ? (
          <div className="product-grid shop-grid" aria-busy="true">
            <p className="sr-only">Loading products</p>
            {Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : null}
        {status === 'ready' ? (
          <>
            {selected ? (
              <>
                <p className="subs-label">Type</p>
                <div className="shop-subcat-scroll" role="group" aria-label="Subcategories">
                  <button
                    type="button"
                    className={subcategory === '' ? 'shop-pill shop-pill--active' : 'shop-pill'}
                    aria-pressed={subcategory === ''}
                    onClick={() => updateParams({ subcategory: '' })}
                  >
                    All
                  </button>
                  {subcategories.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.name === subcategory ? 'shop-pill shop-pill--active' : 'shop-pill'}
                      aria-pressed={item.name === subcategory}
                      onClick={() => updateParams({ subcategory: item.name })}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="subs-label">Categories</p>
                <div className="aisle__row">
                  {categories.map((item) => {
                    const sample = products.find((product) => product.categoryId === item.id)
                    const image = item.image || sample?.image
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="aisle__item"
                        onClick={() => updateParams({ category: item.name, subcategory: '' })}
                      >
                        {image ? <img src={image} alt="" width="64" height="64" /> : null}
                        <span>{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            <div className="shop-controls">
              <TextField
                className="field--compact shop-field-search"
                id="product-search"
                label="Search in this list"
                value={query}
                placeholder="Search in this list"
                onChange={(event) => updateParams({ q: event.target.value })}
              />
              <SelectField
                className="field--compact shop-field-sort"
                id="product-sort"
                label="Sort"
                value={sort}
                onChange={(event) => updateParams({ sort: event.target.value })}
              >
                {sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </SelectField>
            </div>
            <p className="subs-label">Filters</p>
            <div className="shop-filter-scroll" role="group" aria-label="Filters">
              {filters.map(([key, label]) => {
                const active = params.get(key) === '1'
                return (
                  <button
                    key={key}
                    type="button"
                    className={active ? 'shop-filter shop-filter--active' : 'shop-filter'}
                    aria-pressed={active}
                    onClick={() => updateParams({ [key]: active ? '' : '1' })}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="subs-label">Products</p>
            {visible.length === 0 ? (
              <EmptyState
                title="No products match"
                message="Try another name, or clear the filters to see the full basket."
                action={<Button onClick={() => setParams({})}>Clear filters</Button>}
              />
            ) : (
              <div className="product-grid shop-grid">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={addToCart} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  )
}
