import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { SkeletonCard } from '@brand/components/Skeleton.jsx'
import { useToast } from '@brand/toastContext.js'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useShop } from '../context/shopContext.js'
import { formatPrice, variantLabel } from '../data/catalog.js'
import { useAddToCart } from '../useAddToCart.js'

export default function ProductPage() {
  const { id } = useParams()
  const { status, products, error, reload, findProduct } = useCatalog()
  const { wishlist, toggleWishlist } = useShop()
  const addToCart = useAddToCart()
  const showToast = useToast()
  const product = findProduct(id)
  const [variantId, setVariantId] = useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [savingWish, setSavingWish] = useState(false)
  const variant = product?.variants.find((entry) => entry.id === variantId) || product?.variants.find((entry) => entry.isDefault) || product?.variants[0]
  const galleryImages = product && Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [product.image]
      : []
  const image = galleryImages[imageIndex] || galleryImages[0] || product?.image
  const related = product
    ? products
      .filter((item) => item.id !== product.id && item.categoryId === product.categoryId)
      .sort((a, b) => Number(b.subcategoryId && b.subcategoryId === product.subcategoryId) - Number(a.subcategoryId && a.subcategoryId === product.subcategoryId))
      .slice(0, 8)
    : []

  const backTo = product?.category
    ? `/shop?category=${encodeURIComponent(product.category)}`
    : '/shop'

  async function onWish() {
    if (!product) return
    setSavingWish(true)
    try {
      const saved = await toggleWishlist(product.id)
      showToast({ title: saved ? 'Saved to wishlist' : 'Removed from wishlist', message: product.name })
    } catch (reason) {
      showToast({ title: 'Wishlist', message: reason instanceof Error ? reason.message : 'The wishlist could not be updated.' })
    } finally {
      setSavingWish(false)
    }
  }

  if (status === 'loading') {
    return (
      <section className="section product-detail">
        <DocumentTitle title="Product" />
        <div className="container" aria-busy="true">
          <p className="sr-only">Loading product</p>
          <div className="product-detail__skeleton">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="section product-detail">
        <DocumentTitle title="Product" />
        <div className="container narrow">
          <ErrorState title="The product is unavailable" message={error} action={<Button onClick={reload}>Try again</Button>} />
        </div>
      </section>
    )
  }

  if (!product || !variant) {
    return (
      <section className="section product-detail">
        <DocumentTitle title="Product not found" />
        <div className="container narrow">
          <ErrorState
            title="This product is not available"
            message="It may have been removed from the basket. Browse what is in stock today."
            action={<Button to="/shop">Back to shop</Button>}
          />
        </div>
      </section>
    )
  }

  const purchasable = variant.available && variant.stock > 0 && variant.active
  const saved = wishlist.includes(product.id)
  const categoryLine = product.subcategory ? `${product.category} · ${product.subcategory}` : product.category

  return (
    <section className="section product-detail">
      <DocumentTitle title={product.name} />
      <div className="container">
        <header className="product-detail__toolbar">
          <Link to={backTo} className="shop-back" aria-label="Back to list">
            <span aria-hidden="true">‹</span>
          </Link>
          <span className="subs-muted product-detail__toolbar-hint">Product</span>
        </header>

        <div className="product-detail__main">
          <div className="product-detail__media">
            <img src={image} width="640" height="640" alt="" />
            {galleryImages.length > 1 ? (
              <div className="product-detail__thumbs" role="group" aria-label="Product images">
                {galleryImages.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    className={index === imageIndex ? 'product-detail__thumb product-detail__thumb--active' : 'product-detail__thumb'}
                    aria-pressed={index === imageIndex}
                    onClick={() => setImageIndex(index)}
                  >
                    <img src={src} alt="" width="96" height="96" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="product-detail__info">
            <p className="subs-label">{categoryLine}</p>
            <h1 className="product-detail__title">{product.name}</h1>
            {product.description ? <p className="subs-muted product-detail__desc">{product.description}</p> : null}

            <div className="product-detail__tags">
              {product.subscription ? <span className="product-detail__tag">Subscription</span> : null}
              {product.quickDelivery ? <span className="product-detail__tag product-detail__tag--amber">Quick</span> : null}
              {variant.discountPercent > 0 ? <span className="product-detail__tag product-detail__tag--green">{variant.discountPercent}% off</span> : null}
            </div>

            <div className="product-detail__price-row">
              <strong className="product-detail__price">{formatPrice(variant.sellingPrice)}</strong>
              {variant.discount > 0 ? <s className="product-detail__mrp">{formatPrice(variant.mrp)}</s> : null}
              <span className="product-detail__unit">{variantLabel(variant)}</span>
            </div>

            <p className="subs-muted product-detail__stock">
              {purchasable ? `${variant.stock} in stock` : 'Out of stock'}
            </p>

            {product.variants.length > 1 ? (
              <>
                <p className="subs-label">Size</p>
                <div className="shop-subcat-scroll product-detail__variants" role="radiogroup" aria-label="Variants">
                  {product.variants.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={entry.id === variant.id}
                      className={entry.id === variant.id ? 'shop-pill shop-pill--active' : 'shop-pill'}
                      onClick={() => setVariantId(entry.id)}
                    >
                      {variantLabel(entry)} · {formatPrice(entry.sellingPrice)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="subs-muted">Unit: {variantLabel(variant)}</p>
            )}

            <div className="product-detail__cta">
              <Button className="sub-cta" onClick={() => addToCart(product, variant)} disabled={!purchasable}>
                {purchasable ? 'Add to cart' : 'Out of stock'}
              </Button>
              <Button variant="outline" onClick={onWish} disabled={savingWish}>
                {saved ? 'Saved' : 'Wishlist'}
              </Button>
              {product.subscription ? (
                <Button className="sub-cta" to={`/subscriptions?product=${product.id}`}>
                  Add to subscription
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <div className="container">
          <section className="rail-block quick-rail product-detail__related" aria-label="Related products">
            <div className="rail-block__head">
              <h2>You may also like</h2>
              <Button variant="ghost" to={backTo}>More in {product.category}</Button>
            </div>
            <div className="rail">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} onAdd={addToCart} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
