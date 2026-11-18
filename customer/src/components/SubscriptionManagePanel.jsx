import { Link } from 'react-router-dom'
import {
  SubscriptionActiveBlock,
  SubscriptionBilling,
  SubscriptionDailyBasket,
  SubscriptionDeliveries,
  prettyDate,
  scheduleLabel,
} from './subscriptionManageShared.jsx'

export { prettyDate, scheduleLabel } from './subscriptionManageShared.jsx'

export default function SubscriptionManagePanel({
  sub,
  error: externalError,
  showBackLink = false,
}) {
  const displayError = externalError

  return (
    <>
      {displayError ? <p className="order-track__alert" role="alert">{displayError}</p> : null}

      <div className="subs-detail subs-detail--inline subs-detail--core">
        <SubscriptionActiveBlock sub={sub} />
        <SubscriptionDailyBasket sub={sub} />
        <SubscriptionBilling sub={sub} />
        <SubscriptionDeliveries sub={sub} />
        {showBackLink ? <Link className="order-track__back" to="/subscriptions">All subscriptions</Link> : null}
      </div>

    </>
  )
}