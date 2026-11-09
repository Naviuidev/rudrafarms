import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Logo from '@brand/components/Logo.jsx'
import DeliveryBar from './DeliveryBar.jsx'
import LocationSheet from './LocationSheet.jsx'
import UserAccountMenu from './UserAccountMenu.jsx'
import { useShop } from '../context/shopContext.js'

const links = [
  { to: '/shop', label: 'Shop' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/quick-delivery', label: 'Quick delivery' },
]

export default function StoreHeader({ compact = false }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { count, wishlist, locationSheetOpen, closeLocationSheet } = useShop()
  const [scrolled, setScrolled] = useState(false)
  const home = pathname === '/'

  useEffect(() => {
    if (!home || compact) return undefined
    let frame = 0
    let last = window.scrollY
    let accumulated = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - last
        last = y
        if (y <= 12) {
          accumulated = 0
          setScrolled(false)
          return
        }
        if (delta === 0) return
        if ((accumulated > 0 && delta < 0) || (accumulated < 0 && delta > 0)) accumulated = 0
        accumulated += delta
        if (accumulated > 36) setScrolled(true)
        else if (accumulated < -28) setScrolled(false)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [home, compact])

  function searchProducts(event) {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }

  return (
    <div className={`chrome${home ? ' chrome--home' : ''}${home && scrolled ? ' chrome--scrolled' : ''}`}>
      <header className="header">
        <div className="container header__bar">
          <div className="header__start">
            <Logo />
          </div>
          <form className="header-search" role="search" onSubmit={searchProducts}>
            <label className="sr-only" htmlFor="header-search">Search products</label>
            <input
              id="header-search"
              type="search"
              placeholder="Search products"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" aria-label="Search">
              <SearchIcon />
            </button>
          </form>
          <div className="header__tools">
            <NavLink
              to="/wishlist"
              className="tool header__wish"
              aria-label={`Wishlist, ${wishlist.length} ${wishlist.length === 1 ? 'item' : 'items'}`}
            >
              <HeartIcon />
              <span className="tool__label">Wishlist</span>
              {wishlist.length > 0 ? <span className="tool__count">{wishlist.length}</span> : null}
            </NavLink>
            <UserAccountMenu className="header__tool--desktop" />
            <NavLink
              to="/cart"
              className="tool header__tool--desktop"
              aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
            >
              <CartIcon />
              <span className="tool__label">Cart</span>
              {count > 0 ? <span className="tool__count">{count}</span> : null}
            </NavLink>
          </div>
        </div>
        {compact ? null : <DeliveryBar />}
        <LocationSheet open={locationSheetOpen} onClose={closeLocationSheet} />
        {compact ? null : (
          <nav id="primary-nav" className="nav nav--desktop" aria-label="Primary">
            <div className="nav__clip">
              <div className="container nav__row">
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to}>
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>
        )}
      </header>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm5-2 4 4" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM6.2 6l.4 2h12.7l-1.4 7H8.1L6.2 6zM5 4H2V2h3.2l.5 2H21l-2.2 10H7.2L5 4z" />
    </svg>
  )
}
