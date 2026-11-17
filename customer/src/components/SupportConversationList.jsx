import { useMemo, useState } from 'react'
import ContactThread from './ContactThread.jsx'
import SupportDateTile from './SupportDateTile.jsx'

export default function SupportConversationList({ queries, allowReply = false, onUpdated }) {
  const [activeId, setActiveId] = useState('')

  const sorted = useMemo(
    () => [...(queries || [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [queries],
  )

  const activeQuery = sorted.find((row) => row.id === activeId) || null

  function selectTile(id) {
    setActiveId((current) => (current === id ? '' : id))
  }

  function handleUpdated(next) {
    onUpdated?.(next)
  }

  return (
    <div className="support-board">
      <div className="support-tile-grid" role="tablist" aria-label="Support dates">
        {sorted.map((query) => (
          <SupportDateTile
            key={query.id}
            query={query}
            active={activeId === query.id}
            onSelect={() => selectTile(query.id)}
          />
        ))}
      </div>

      {activeQuery ? (
        <ContactThread
          key={activeQuery.id}
          query={activeQuery}
          allowReply={allowReply}
          onUpdated={handleUpdated}
          variant="detail"
          detailId={`support-detail-${activeQuery.id}`}
        />
      ) : (
        <p className="subs-muted support-board__hint">Tap a date to view the conversation.</p>
      )}
    </div>
  )
}