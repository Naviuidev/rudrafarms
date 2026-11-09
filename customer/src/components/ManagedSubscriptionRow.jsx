import { useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import { SubscriptionApiError, fetchSubscriptionDetail } from '../api/subscriptionApi.js'
import SubscriptionManagePanel, { scheduleLabel } from './SubscriptionManagePanel.jsx'

export default function ManagedSubscriptionRow({ sub, open, onToggle, onSubscriptionChange }) {
  const [detail, setDetail] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancel = false
    setLoading(true)
    setLoadError('')
    fetchSubscriptionDetail(sub.id).then((data) => {
      if (cancel) return
      setDetail(data.subscription)
      setLoading(false)
    }).catch((reason) => {
      if (cancel) return
      setDetail(null)
      setLoadError(reason instanceof SubscriptionApiError ? reason.message : 'Could not load subscription.')
      setLoading(false)
    })
    return () => {
      cancel = true
    }
  }, [open, sub.id])

  function handleSubChange(next) {
    setDetail(next)
    onSubscriptionChange?.(next)
  }

  return (
    <li className="subs-manage-item">
      <div className="subs-row subs-row--manage">
        <div>
          <strong>{sub.statusLabel}</strong>
          <p className="subs-muted">
            Started {sub.startDate} · {scheduleLabel(sub.scheduleKey) || `${sub.scheduleKey} drop`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls={`subs-manage-${sub.id}`}
          onClick={onToggle}
        >
          {open ? 'Close' : 'Manage'}
        </Button>
      </div>
      {open ? (
        <div id={`subs-manage-${sub.id}`} className="subs-manage-drawer" aria-label="Subscription details">
          {loading ? <p className="subs-muted" role="status">Loading subscription…</p> : null}
          {!loading && loadError ? <p className="field__error" role="alert">{loadError}</p> : null}
          {!loading && detail ? (
            <SubscriptionManagePanel
              sub={detail}
              onSubChange={handleSubChange}
              externalError=""
              onError={setLoadError}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
