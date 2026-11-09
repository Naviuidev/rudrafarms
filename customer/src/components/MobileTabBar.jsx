import { NavLink, useLocation } from 'react-router-dom'
import { useShop } from '../context/shopContext.js'

const tabs = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/subscriptions', label: 'Subscriptions', icon: SubIcon },
  { to: '/account', label: 'Account', icon: UserIcon, authFallback: '/login' },
  { to: '/cart', label: 'Cart', icon: CartIcon, showCount: true },
]

export default function MobileTabBar() {
  const { pathname } = useLocation()
  const { count, account } = useShop()

  return (
    <nav className="mobile-tab-bar" aria-label="App navigation">
      {tabs.map((tab) => {
        const to = tab.authFallback && !account ? tab.authFallback : tab.to
        const active = tab.to === '/account'
          ? pathname.startsWith('/account') || pathname === '/login'
          : tab.end
            ? pathname === tab.to
            : pathname.startsWith(tab.to)
        return (
          <NavLink
            key={tab.to}
            to={to}
            className={active ? 'mobile-tab-bar__item mobile-tab-bar__item--active' : 'mobile-tab-bar__item'}
            aria-current={active ? 'page' : undefined}
          >
            <span className="mobile-tab-bar__icon" aria-hidden="true">
              <tab.icon />
              {tab.showCount && count > 0 ? <span className="mobile-tab-bar__badge">{count > 9 ? '9+' : count}</span> : null}
            </span>
            <span className="mobile-tab-bar__label">{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M12 3 3 11h2v9h6v-6h2v6h6v-9h2z" />
    </svg>
  )
}

function SubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M7 4h10v2H7zm-2 4h14v2H5zm2 4h10v10H7zm2 2v6h6v-6z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM6.2 6l.4 2h12.7l-1.4 7H8.1L6.2 6zM5 4H2V2h3.2l.5 2H21l-2.2 10H7.2L5 4z" />
    </svg>
  )
}
