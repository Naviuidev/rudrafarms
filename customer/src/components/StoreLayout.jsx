import { Outlet } from 'react-router-dom'
import StoreFooter from './StoreFooter.jsx'
import StoreHeader from './StoreHeader.jsx'

export default function StoreLayout() {
  return (
    <div className="store">
      <a className="skip-link" href="#main">Skip to content</a>
      <StoreHeader />
      <main id="main">
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  )
}
