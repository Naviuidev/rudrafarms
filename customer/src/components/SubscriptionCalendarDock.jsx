import { useEffect, useRef, useState } from 'react'
import Dialog from '@brand/components/Dialog.jsx'
import {
  SubscriptionCalendarView,
  SubscriptionNoticeDialogs,
  SubscriptionPauseForm,
  SubscriptionPausedList,
  SubscriptionSkipDeliveryForm,
  SubscriptionSkippedList,
  useSubscriptionManagement,
} from './subscriptionManageShared.jsx'

const MENU = [
  { key: 'calendar', label: 'Your calendar', title: 'Your calendar' },
  { key: 'skip', label: 'Skip your delivery', title: 'Skip your delivery' },
  { key: 'skipped', label: 'Skipped deliveries', title: 'Skipped deliveries' },
  { key: 'pause', label: 'Pause your subscription', title: 'Pause your subscription' },
  { key: 'paused', label: 'Paused subscriptions', title: 'Paused subscriptions' },
]

export default function SubscriptionCalendarDock({ sub, onSubChange, loading = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState('')
  const rootRef = useRef(null)
  const mgmt = useSubscriptionManagement(sub, onSubChange, () => {})

  useEffect(() => {
    if (!menuOpen) return undefined
    function onPointerDown(event) {
      if (rootRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  function openDialog(key) {
    setMenuOpen(false)
    setDialogKey(key)
  }

  function closeDialog() {
    setDialogKey('')
  }

  const active = MENU.find((item) => item.key === dialogKey)
  const ready = Boolean(sub?.id)

  return (
    <>
      <div ref={rootRef} className="subs-calendar-dock" aria-label="Subscription calendar tools">
        {menuOpen ? (
          <ul className="subs-calendar-dock__menu" role="menu">
            {MENU.map((item) => (
              <li key={item.key} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="subs-calendar-dock__menu-btn"
                  disabled={!ready || loading}
                  onClick={() => openDialog(item.key)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="subs-calendar-dock__fab"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={menuOpen ? 'Close subscription menu' : 'Open subscription calendar menu'}
          disabled={!ready || loading}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <CalendarIcon />
        </button>
      </div>

      {active && sub ? (
        <Dialog
          open
          title={active.title}
          className={dialogKey === 'calendar' ? 'dialog--subs-calendar' : ''}
          onClose={closeDialog}
        >
          {dialogKey === 'calendar' ? <SubscriptionCalendarView sub={sub} /> : null}
          {dialogKey === 'skip' ? <SubscriptionSkipDeliveryForm sub={sub} mgmt={mgmt} /> : null}
          {dialogKey === 'skipped' ? <SubscriptionSkippedList sub={sub} mgmt={mgmt} /> : null}
          {dialogKey === 'pause' ? <SubscriptionPauseForm sub={sub} mgmt={mgmt} /> : null}
          {dialogKey === 'paused' ? <SubscriptionPausedList sub={sub} mgmt={mgmt} /> : null}
        </Dialog>
      ) : null}

      <SubscriptionNoticeDialogs sub={sub} mgmt={mgmt} />
    </>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3v3M17 3v3M4.5 8.5h15M6 5.5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z"
      />
    </svg>
  )
}