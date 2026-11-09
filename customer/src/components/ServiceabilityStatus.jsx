import Badge from '@brand/components/Badge.jsx'

/** @param {'subscription' | 'quick' | 'both'} mode */
export default function ServiceabilityStatus({
  service,
  checking = false,
  error = '',
  hideUnchecked = false,
  mode = 'both',
  compact = false,
}) {
  if (error) {
    return <p className={compact ? 'address-status address-status--error' : 'field__error'} role="alert">{error}</p>
  }

  if (checking) {
    const text = mode === 'subscription' ? 'Checking area…' : 'Checking…'
    if (compact) return <p className="address-status address-status--wait" role="status">{text}</p>
    return <p role="status">{mode === 'subscription' ? 'Checking subscription delivery areas…' : 'Checking delivery point…'}</p>
  }

  if (!service) {
    if (hideUnchecked) return null
    if (compact) return null
    return (
      <p className="subs-muted">
        {mode === 'subscription'
          ? 'Set a map point to check against the store’s subscription areas.'
          : 'Set a map point so the store knows where to deliver.'}
      </p>
    )
  }

  if (mode === 'quick') {
    const ok = Boolean(service.allowed)
    const zone = service.selectedQuickZone || (service.quickZones && service.quickZones[0])
    if (compact) {
      return (
        <p className={ok ? 'address-status address-status--ok' : 'address-status address-status--warn'} role="status">
          {ok ? (zone || 'In Vizag service area') : (service.message || 'Outside Vizag delivery area')}
        </p>
      )
    }
    return (
      <ul className="availability">
        <li>
          <span>Delivery area</span>
          <Badge tone={ok ? 'green' : 'amber'}>{ok ? (zone || 'Vizag') : 'Outside area'}</Badge>
        </li>
        {!ok && service.message ? (
          <li><span>{service.message}</span></li>
        ) : null}
      </ul>
    )
  }

  const inZone = Boolean(service.subscription)
  const zones = Array.isArray(service.subscriptionZones) ? service.subscriptionZones : []

  if (compact) {
    if (inZone) {
      const label = zones[0] || service.selectedSubscriptionZone || 'In delivery area'
      return <p className="address-status address-status--ok" role="status">{label}</p>
    }
    return <p className="address-status address-status--warn" role="status">Outside subscription area</p>
  }

  return (
    <ul className="availability">
      <li>
        <span>Subscription area</span>
        <Badge tone={inZone ? 'green' : 'amber'}>{inZone ? 'Inside service area' : 'Outside service area'}</Badge>
      </li>
      {inZone && zones.length > 0 ? (
        <li>
          <span>Matched</span>
          <span>{zones.join(', ')}</span>
        </li>
      ) : null}
      {mode === 'both' && !inZone && service.message ? (
        <li><span>{service.message}</span></li>
      ) : null}
    </ul>
  )
}
