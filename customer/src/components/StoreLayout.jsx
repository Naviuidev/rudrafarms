import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import MobileTabBar from './MobileTabBar.jsx'
import StoreFooter from './StoreFooter.jsx'
import StoreHeader from './StoreHeader.jsx'
import { useShop } from '../context/shopContext.js'

function LocationPrompt() {
  const { pathname } = useLocation()
  const { locationsReady, hasDeliverySet, openLocationSheet } = useShop()

  useEffect(() => {
    if (!locationsReady || hasDeliverySet) return
    if (sessionStorage.getItem('rudras.location.prompted')) return
    if (/^\/(login|register|addresses)(\/|$)/.test(pathname)) return
    sessionStorage.setItem('rudras.location.prompted', '1')
    openLocationSheet()
  }, [locationsReady, hasDeliverySet, pathname, openLocationSheet])

  return null
}

export default function StoreLayout() {
  return (
    <div className="store">
      <a className="skip-link" href="#main">Skip to content</a>
      <LocationPrompt />
      <StoreHeader />
      <main id="main">
        <Outlet />
      </main>
      <StoreFooter />
      <MobileTabBar />
    </div>
  )
}
