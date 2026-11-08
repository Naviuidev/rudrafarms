import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { SkeletonCard } from '@brand/components/Skeleton.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useShop } from '../context/shopContext.js'
import { useAddToCart } from '../useAddToCart.js'

export default function WishlistPage() {
  const addToCart = useAddToCart()
  const { status, error, reload, findProduct } = useCatalog()
  const { wishlist } = useShop()
  const products = wishlist.map((id) => findProduct(id)).filter(Boolean)

  return (
    <section className="section account-page">
      <DocumentTitle title="Wishlist" />
      <div className="container">
        <header className="account-head">
          <h1>Wishlist</h1>
          <p className="subs-muted">Products you saved for later.</p>
        </header>
        {status === 'loading' ? (
          <div className="product-grid product-grid--small" aria-busy="true">
            <p className="sr-only">Loading wishlist</p>
            {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : null}
        {status === 'error' ? (
          <ErrorState title="The wishlist is unavailable" message={error} action={<Button onClick={reload}>Try again</Button>} />
        ) : null}
        {status === 'ready' && products.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            message="Tap the heart on a product to keep it here."
            action={<Button to="/shop">Browse products</Button>}
          />
        ) : null}
        {status === 'ready' && products.length > 0 ? (
          <div className="product-grid product-grid--small">
            {products.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}
          </div>
        ) : null}
      </div>
    </section>
  )
}
