import { Link } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { SkeletonCard } from '@brand/components/Skeleton.jsx'
import PlanBanner from '../components/PlanBanner.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/catalogContext.js'
import { useAddToCart } from '../useAddToCart.js'

function ProductRail({ title, items, onAdd, action, loading }) {
  if (!loading && items.length === 0) return null
  return (
    <section className="rail-block">
      <div className="rail-block__head">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="rail">
        {loading
          ? Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)
          : items.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={onAdd} />
          ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  const addToCart = useAddToCart()
  const { status, categories, products } = useCatalog()
  const loading = status === 'loading'
  const popular = products.filter((product) => product.popular)
  const bestsellers = products.filter((product) => product.bestseller)
  const highlights = categories.flatMap((category) => {
    const sample = products.find((product) => product.categoryId === category.id)
    const image = category.image || sample?.image
    return image ? [{ name: category.name, image }] : []
  })

  return (
    <>
      <DocumentTitle title="RudrasFarmFresh" />
      <div className="home">
        <PlanBanner />
        <div className="container">
          <section className="aisle" aria-label="Categories">
            <div className="aisle__row">
              {highlights.map((category) => (
                <Link
                  key={category.name}
                  className="aisle__item"
                  to={`/shop?category=${encodeURIComponent(category.name)}`}
                >
                  <img src={category.image} alt="" width="64" height="64" />
                  <span>{category.name}</span>
                </Link>
              ))}
            </div>
          </section>

          <div className="service-badges">
            <Button className="service-badge service-badge--subscription" variant="ghost" to="/subscriptions">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2zM5 3h2v2h10V3h2v2h2a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V3zm14 6H5v11h14V9z" />
              </svg>
              Monthly subscription
            </Button>
            <Button className="service-badge service-badge--quick" variant="ghost" to="/quick-delivery">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M3 7h11v8H3V7zm12 2h2.5L20 12v3h-5V9zM6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM1 17h2.1a3.5 3.5 0 0 0 6.8 0h3.2a3.5 3.5 0 0 0 6.8 0H22v-2h-2V12l-3-4H14V5H1v12z" />
              </svg>
              Quick delivery
            </Button>
          </div>

          <ProductRail
            title="Popular"
            items={popular}
            loading={loading}
            onAdd={addToCart}
            action={<Button variant="ghost" to="/shop">See all</Button>}
          />
          <ProductRail
            title="Best sellers"
            items={bestsellers}
            loading={loading}
            onAdd={addToCart}
          />
        </div>
      </div>
    </>
  )
}
