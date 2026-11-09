import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Logo from '@brand/components/Logo.jsx'
import { deliverySection, deliverySections } from '../deliveries/sections.js'
import { developerSection, developerSections } from '../developer/sections.js'
import { orderSection, orderSections } from '../orders/sections.js'
import { settingsSection, settingsSections } from '../settings/sections.js'
import { websiteSection, websiteSections } from '../website/sections.js'
import { signOutAdmin } from '../auth/session.js'

const sections = [
  {
    label: 'Overview',
    links: [{ to: '/', label: 'Dashboard', end: true, Icon: IconDashboard }],
  },
  {
    label: 'Customers',
    links: [{ to: '/customers', label: 'Customers', Icon: IconUsers }],
  },
  {
    label: 'Catalog',
    links: [
      { to: '/products', label: 'Products', Icon: IconBox },
      { to: '/inventory', label: 'Inventory', Icon: IconLayers },
    ],
  },
  {
    label: 'Sales',
    links: [
      { to: '/orders', label: 'Orders', Icon: IconCart },
      { to: '/coupons', label: 'Coupons', Icon: IconTag },
    ],
  },
  {
    label: 'Subscriptions',
    links: [
      { to: '/subscriptions', label: 'Live plans', end: true, Icon: IconRepeat },
      { to: '/subscriptions/plans', label: 'Plan setup', Icon: IconRepeat },
    ],
  },
  {
    label: 'Operations',
    links: [
      { to: '/deliveries', label: 'Deliveries', Icon: IconTruck },
      { to: '/locations', label: 'Service zones', Icon: IconPin },
    ],
  },
  {
    label: 'System',
    links: [
      { to: '/website', label: 'Website', Icon: IconGlobe },
      { to: '/settings', label: 'Settings', Icon: IconGear },
      { to: '/developer', label: 'Configs', Icon: IconCode },
    ],
  },
]

export default function AdminLayout() {
  const [railOpen, setRailOpen] = useState(false)
  const [clock, setClock] = useState(() => timeLabel())
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const onDeliveries = location.pathname === '/deliveries'
  const onWebsite = location.pathname === '/website'
  const onOrder = /^\/orders\/[^/]+$/.test(location.pathname)
  const onSettings = location.pathname === '/settings'
  const onDeveloper = location.pathname === '/developer'
  const section = deliverySection(params.get('section'))
  const siteSection = websiteSection(params.get('section'))
  const orderSectionId = orderSection(params.get('section'))
  const settingsSectionId = settingsSection(params.get('section'))
  const developerSectionId = developerSection(params.get('section'))

  useEffect(() => {
    const id = window.setInterval(() => setClock(timeLabel()), 30000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!railOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') setRailOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [railOpen])

  return (
    <div className={onDeliveries ? 'admin admin--deliveries' : onWebsite ? 'admin admin--website' : onOrder ? 'admin admin--order' : onSettings ? 'admin admin--settings' : onDeveloper ? 'admin admin--developer' : 'admin'}>
      <a className="skip-link" href="#main">Skip to content</a>
      {railOpen ? <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setRailOpen(false)} /> : null}
      <aside className={railOpen ? 'admin-rail admin-rail--open' : 'admin-rail'} id="admin-nav" aria-label="Primary">
        <div className="admin-rail__logo">
          <Logo />
        </div>
        <nav className="admin-rail__nav">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="admin-rail__group">{section.label}</p>
              {section.links.map(({ to, label, end, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => (isActive ? 'admin-rail__link admin-rail__link--active' : 'admin-rail__link')}
                  onClick={() => setRailOpen(false)}
                >
                  <Icon />
                  <span className="admin-rail__label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      {onDeliveries ? (
        <aside className="admin-secondary" aria-label="Deliveries">
          <p className="admin-secondary__title">Deliveries</p>
          <nav className="admin-secondary__nav">
            {deliverySections.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={section === item.id ? 'page' : undefined}
                onClick={() => setParams({ section: item.id })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      {onOrder ? (
        <aside className="admin-secondary" aria-label="Order">
          <p className="admin-secondary__title">Order</p>
          <nav className="admin-secondary__nav">
            {orderSections.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={orderSectionId === item.id ? 'page' : undefined}
                onClick={() => setParams({ section: item.id })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      {onDeveloper ? (
        <aside className="admin-secondary" aria-label="Configs">
          <p className="admin-secondary__title">Configs</p>
          <nav className="admin-secondary__nav">
            {developerSections.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={developerSectionId === item.id ? 'page' : undefined}
                onClick={() => setParams({ section: item.id })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      {onSettings ? (
        <aside className="admin-secondary" aria-label="Settings">
          <p className="admin-secondary__title">Settings</p>
          <nav className="admin-secondary__nav">
            {settingsSections.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={settingsSectionId === item.id ? 'page' : undefined}
                onClick={() => setParams({ section: item.id })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      {onWebsite ? (
        <aside className="admin-secondary" aria-label="Website">
          <p className="admin-secondary__title">Website</p>
          <nav className="admin-secondary__nav">
            {websiteSections.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={siteSection === item.id ? 'page' : undefined}
                onClick={() => setParams({ section: item.id })}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      <div className="admin__main">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={railOpen}
            aria-controls="admin-nav"
            onClick={() => setRailOpen((open) => !open)}
          >
            <span className="sr-only">{railOpen ? 'Close menu' : 'Open menu'}</span>
            <span aria-hidden="true">☰</span>
          </button>
          <p className="topbar__title">Rudras Farm Fresh</p>
          <span className="topbar__live" title="Lists refresh about every 15 seconds">Live · {clock}</span>
          <button
            type="button"
            className="topbar__account"
            onClick={() => {
              signOutAdmin()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </header>
        <main id="main" className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function timeLabel() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 4h7v9H4V4zm9 0h7v5h-7V4zM4 15h7v5H4v-5zm9 4h7v-5h-7v5z" /></svg>
  )
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45v2.5h7v-3c0-2.66-5.33-4-8-4z" /></svg>
  )
}
function IconBox() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M21 8l-9-5-9 5 9 5 9-5zm-9 7L3 10v8l9 5 9-5v-8l-9 5z" /></svg>
  )
}
function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2 2 7l10 5 10-5-10-5zm0 8.2L4.7 8 12 4.8 19.3 8 12 10.2zM4 10.3l8 4 8-4v5l-8 4-8-4v-5z" /></svg>
  )
}
function IconCart() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM6.2 6l.4 2h12.7l-1.4 7H8.1L6.2 6zM5 4H2V2h3.2l.5 2H21l-2.2 10H7.2L5 4z" /></svg>
  )
}
function IconRepeat() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7 7h12v3l4-4-4-4v3H5v6h2V7zm10 10H5v-3l-4 4 4 4v-3h14v-6h-2v4z" /></svg>
  )
}
function IconTag() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M21.4 11.6 12.4 2.6c-.8-.8-2-.8-2.8 0L2.6 9.6c-.8.8-.8 2 0 2.8l9 9c.4.4 1 .4 1.4 0l9-9c.8-.8.8-2 0-2.8zM7.5 7.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" /></svg>
  )
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" /></svg>
  )
}
function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 4h11v8H3V4zm12 0h3l3 4v4h-6V4zM6 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM1 18h2a4 4 0 0 0 8 0h2a4 4 0 0 0 8 0h2v-5h-6l-3-4H1v9z" /></svg>
  )
}
function IconCode() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8.7 16.3 4.4 12l4.3-4.3L7.3 6.3 1.6 12l5.7 5.7 1.4-1.4zm6.6 0 4.3-4.3-4.3-4.3 1.4-1.4 5.7 5.7-5.7 5.7-1.4-1.4z" /></svg>
  )
}
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.2a15.7 15.7 0 0 0-1.2-5 8.1 8.1 0 0 1 4.4 5zM12 4c.8 1.2 1.8 3.2 2.2 7H9.8C10.2 7.2 11.2 5.2 12 4zM4.1 13h3.2a15.7 15.7 0 0 0 1.2 5 8.1 8.1 0 0 1-4.4-5zM7.3 11H4.1a8.1 8.1 0 0 1 4.4-5 15.7 15.7 0 0 0-1.2 5zM12 20c-.8-1.2-1.8-3.2-2.2-7h4.4c-.4 3.8-1.4 5.8-2.2 7zm2.3-2a15.7 15.7 0 0 0 1.2-5h3.2a8.1 8.1 0 0 1-4.4 5z" /></svg>
  )
}
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm9.4 4.5 1.4-1.1-1.2-2.1-1.7.7-1.1-.9-1.1.9-1.7-.7-1.2 2.1 1.4 1.1-.2 1.4h2.4l-.2-1.4zM3.6 12.5 2.2 13.6l1.2 2.1 1.7-.7 1.1.9 1.1-.9 1.7.7 1.2-2.1-1.4-1.1.2-1.4H3.4l.2 1.4z" /></svg>
  )
}
