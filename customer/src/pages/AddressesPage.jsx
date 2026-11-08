import { Link } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import AddressBook from '../components/AddressBook.jsx'
import { useShop } from '../context/shopContext.js'

export default function AddressesPage() {
  const { account } = useShop()
  return (
    <section className="section account-page addresses-page">
      <DocumentTitle title="Addresses" />
      <div className="container narrow">
        <header className="account-head">
          <h1>Addresses</h1>
          <p className="subs-muted">
            Save more than one address and choose a default.
            {' '}
            {account
              ? 'Signed-in addresses stay on your account.'
              : 'Sign in to keep these addresses on your account.'}
            {' '}
            Subscription delivery is available only inside a location saved by the store.
          </p>
        </header>
        <AddressBook />
        <nav className="account-nav" aria-label="Account">
          <Link to="/account">Profile</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/subscriptions">Subscriptions</Link>
        </nav>
      </div>
    </section>
  )
}
