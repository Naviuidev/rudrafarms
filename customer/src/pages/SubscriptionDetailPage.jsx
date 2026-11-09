import { useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { SubscriptionApiError, fetchSubscriptionDetail } from '../api/subscriptionApi.js'
import SubscriptionManagePanel, { prettyDate, scheduleLabel } from '../components/SubscriptionManagePanel.jsx'
import { useShop } from '../context/shopContext.js'
import { useParams } from 'react-router-dom'

export default function SubscriptionDetailPage() {
  const { subscriptionId } = useParams()
  const { account } = useShop()
  const [sub, setSub] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancel = false
    if (!subscriptionId || !account) return undefined
    fetchSubscriptionDetail(subscriptionId).then((data) => {
      if (cancel) return
      setSub(data.subscription)
      setError('')
    }).catch((reason) => {
      if (cancel) return
      setSub(null)
      setError(reason instanceof SubscriptionApiError ? reason.message : 'Could not load subscription.')
    })
    return () => {
      cancel = true
    }
  }, [subscriptionId, account])

  if (!account) {
    return (
      <section className="section account-page subs-page">
        <DocumentTitle title="Subscription" />
        <div className="container">
          <header className="account-head">
            <h1>Subscription</h1>
            <p className="subs-muted">Sign in to manage this daily plan.</p>
          </header>
          <ErrorState title="Sign in" message="Manage subscriptions from your account." action={<Button to="/login">Sign in</Button>} />
        </div>
      </section>
    )
  }

  if (!sub) {
    return (
      <section className="section account-page subs-page">
        <DocumentTitle title="Subscription" />
        <div className="container">
          <header className="account-head">
            <h1>Subscription</h1>
          </header>
          {error ? <ErrorState title="Subscription unavailable" message={error} action={<Button to="/subscriptions">All subscriptions</Button>} /> : <p className="subs-muted" role="status">Loading subscription…</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="section account-page subs-page">
      <DocumentTitle title="Subscription" />
      <div className="container">
        <header className="account-head">
          <h1>{sub.statusLabel}</h1>
          <p className="subs-muted">{scheduleLabel(sub.scheduleKey)} · Started {prettyDate(sub.startDate)}</p>
        </header>

        <SubscriptionManagePanel sub={sub} onSubChange={setSub} error={error} onError={setError} showBackLink />
      </div>
    </section>
  )
}
