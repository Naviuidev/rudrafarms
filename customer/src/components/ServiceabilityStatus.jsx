import Badge from '@brand/components/Badge.jsx'

export default function ServiceabilityStatus({ service, checking = false, error = '', hideUnchecked = false }) {
  if (error) return <p className="field__error" role="alert">{error}</p>
  if (checking) return <p role="status">Checking the subscription areas…</p>
  if (!service) {
    if (hideUnchecked) return null
    return <p>This address has not been checked against the subscription areas yet.</p>
  }

  return (
    <ul className="availability">
      <li>
        <span>Subscription area</span>
        <Badge tone={service.subscription ? 'green' : 'amber'}>{service.subscription ? 'Available' : 'Not available'}</Badge>
      </li>
    </ul>
  )
}
