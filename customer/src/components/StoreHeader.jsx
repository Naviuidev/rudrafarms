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
  { to: '/about', label: 'About us' },
  { to: '/support/contact', label: 'Contact' },
]

export default function StoreHeader({ compact = false }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { count, wishlist, locationSheetOpen, closeLocationSheet } = useShop()
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (compact) return undefined
    let frame = 0
    let last = window.scrollY
    let accumulated = 0

    function desktopChrome() {
      return window.matchMedia('(min-width: 1024px)').matches
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!desktopChrome()) {
          setNavCollapsed(false)
          return
        }
        const y = window.scrollY
        const delta = y - last
        last = y
        if (y <= 12) {
          accumulated = 0
          setNavCollapsed(false)
          return
        }
        if (delta === 0) return
        if ((accumulated > 0 && delta < 0) || (accumulated < 0 && delta > 0)) accumulated = 0
        accumulated += delta
        if (accumulated > 36) setNavCollapsed(true)
        else if (accumulated < -28) setNavCollapsed(false)
      })
    }

    const onResize = () => {
      if (!desktopChrome()) setNavCollapsed(false)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [compact])

  function searchProducts(event) {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }

  return (
    <div className={`chrome${navCollapsed ? ' chrome--nav-collapsed' : ''}`}>
      <header className="header">
        <div className="container-fluid header__bar">
          <div className="header__start">
            <Logo />
          </div>
          {compact ? null : (
            <div className="header__delivery">
              <DeliveryBar />
            </div>
          )}
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
          {compact ? null : (
            <nav id="primary-nav" className="nav nav--desktop nav--inline" aria-label="Primary">
              <div className="nav__row nav__row--desktop">
                {links.map((link) => (
                  <NavLink key={link.to} to={link.to}>
                    {link.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}
          <div className="header__tools">
            <button
              type="button"
              className="menu-toggle header__menu-toggle"
              aria-expanded={navOpen}
              aria-controls="mobile-nav"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setNavOpen((value) => !value)}
            >
              <MenuIcon open={navOpen} />
            </button>
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
        {compact ? null : (
          <div className="header__delivery-mobile">
            <DeliveryBar />
          </div>
        )}
        <LocationSheet open={locationSheetOpen} onClose={closeLocationSheet} />
        {compact ? null : (
          <nav
            id="mobile-nav"
            className={navOpen ? 'nav nav--drawer nav--open' : 'nav nav--drawer'}
            aria-label="Menu"
          >
            <div className="container-fluid nav__row nav__row--stack">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} onClick={() => setNavOpen(false)}>
                  {link.label}
                </NavLink>
              ))}
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

function MenuIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}