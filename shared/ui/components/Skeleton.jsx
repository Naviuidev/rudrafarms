import './Skeleton.css'

export default function Skeleton({ className = '', width, height }) {
  return (
    <span
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <Skeleton className="skeleton-card__media" />
      <Skeleton className="skeleton-card__line" />
      <Skeleton className="skeleton-card__line skeleton-card__line--short" />
    </div>
  )
}
