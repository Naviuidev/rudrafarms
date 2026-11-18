import { useShop } from '../context/shopContext.js'

export default function DeliveryBar() {
  const { deliverySummary, openLocationSheet, locationsReady } = useShop()
  const { primary } = deliverySummary
  const label = locationsReady ? primary : 'Loading…'
  const displayLabel = shortenLocationLabel(label)

  return (
    <div className="container-fluid delivery-bar">
      <button
        type="button"
        className="delivery-bar__btn"
        onClick={openLocationSheet}
        aria-label={`Delivery location: ${label}`}
      >
        <span className="delivery-bar__icon" aria-hidden="true">
          <PinIcon />
        </span>
        <span className="delivery-bar__name">{displayLabel}</span>
        <span className="delivery-bar__chev" aria-hidden="true">▾</span>
      </button>
    </div>
  )
}

function shortenLocationLabel(name, maxChars = 6) {
  if (!name || name === 'Loading…') return name
  const chars = [...String(name)]
  return chars.length <= maxChars ? chars.join('') : `${chars.slice(0, maxChars).join('')}…`
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
    </svg>
  )
}