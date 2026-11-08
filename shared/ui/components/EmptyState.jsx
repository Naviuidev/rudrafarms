import './EmptyState.css'

export default function EmptyState({ title, message, action }) {
  return (
    <div className="state-card">
      <span className="state-card__mark" aria-hidden="true">
        <Leaf />
      </span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  )
}

function Leaf() {
  return (
    <svg viewBox="0 0 48 48" width="28" height="28">
      <path d="M10 30c8-1 16-9 24-12-1 12-9 20-22 22-1-4-1-7-2-10z" fill="#228B45" />
      <path d="M14 32c6-7 12-13 18-16" fill="none" stroke="#14532D" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
