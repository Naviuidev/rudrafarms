import { Link } from 'react-router-dom'
import Logo from '@brand/components/Logo.jsx'
import { useCatalog } from '../context/catalogContext.js'

export default function StoreFooter() {
  const { categories } = useCatalog()
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <Logo />
          <p>Farm-fresh milk, dairy, and produce, brought home on your schedule.</p>
        </div>
        <div>
          <h2>Categories</h2>
          {categories.map((category) => (
            <Link key={category.id} to={`/shop?category=${encodeURIComponent(category.name)}`}>
              {category.name}
            </Link>
          ))}
        </div>
        <div>
          <h2>Shop</h2>
          <Link to="/shop">All products</Link>
          <Link to="/subscriptions">Monthly subscription</Link>
          <Link to="/quick-delivery">Quick delivery</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/account">Account</Link>
          <Link to="/addresses">Addresses</Link>
        </div>
        <div>
          <h2>Help</h2>
          <Link to="/support/contact">Contact</Link>
          <Link to="/support/delivery">Delivery policy</Link>
          <Link to="/support/privacy">Privacy</Link>
        </div>
      </div>
      <div className="container footer__base">
        <p>© RudrasFarmFresh</p>
      </div>
    </footer>
  )
}
