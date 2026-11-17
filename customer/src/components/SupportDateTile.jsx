function formatTileDate(value) {
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return { day: '—', month: '' }
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-IN', { month: 'short' }),
  }
}

export default function SupportDateTile({ query, active, onSelect }) {
  const tileDate = formatTileDate(query.createdAt)

  return (
    <button
      type="button"
      className={active ? 'support-tile support-tile--active' : 'support-tile'}
      aria-expanded={active}
      aria-controls={active ? `support-detail-${query.id}` : undefined}
      onClick={onSelect}
    >
      <span className="support-tile__day">{tileDate.day}</span>
      <span className="support-tile__month">{tileDate.month}</span>
      <span
        className={`support-tile__status support-tile__status--${query.status === 'contacted' ? 'done' : 'open'}`}
        aria-hidden="true"
      />
      <span className="sr-only">{query.topicLabel}, {query.statusLabel}</span>
    </button>
  )
}