import { Outlet } from 'react-router-dom'
import StoreHeader from './StoreHeader.jsx'

export default function AuthLayout() {
  return (
    <div className="auth-screen">
      <a className="skip-link" href="#main">Skip to content</a>
      <StoreHeader compact />
      <main id="main">
        <Outlet />
      </main>
    </div>
  )
}
