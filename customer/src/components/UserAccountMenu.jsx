import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useShop } from '../context/shopContext.js'

function prefersHoverMenu() {
  return typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export default function UserAccountMenu() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { account, logout } = useShop()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const returnFrom = `${pathname}${search}`

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!account) {
    return (
      <NavLink to="/login" state={{ from: returnFrom }} className="tool">
        <UserIcon />
        <span className="tool__label">Sign in</span>
      </NavLink>
    )
  }

  const label = account.name.trim().split(/\s+/)[0] || account.name

  async function signOut() {
    setOpen(false)
    await logout()
    navigate('/')
  }

  function toggleMenu() {
    if (prefersHoverMenu()) return
    setOpen((current) => !current)
  }

  return (
    <div
      ref={rootRef}
      className={`user-menu${open ? ' user-menu--open' : ''}`}
    >
      <button
        type="button"
        className="tool user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggleMenu}
      >
        <UserIcon />
        <span className="tool__label">{label}</span>
      </button>
      <div className="user-menu__drop">
        <div className="user-menu__panel" role="menu" aria-label="Account">
          <Link to="/orders" className="user-menu__item" role="menuitem" onClick={() => setOpen(false)}>
            Orders
          </Link>
          <Link to="/account/settings" className="user-menu__item" role="menuitem" onClick={() => setOpen(false)}>
            Settings
          </Link>
          <button type="button" className="user-menu__item user-menu__item--action" role="menuitem" onClick={signOut}>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12zm0 2c-4.1 0-7.5 2.2-7.5 5v1h15v-1c0-2.8-3.4-5-7.5-5z" />
    </svg>
  )
}
