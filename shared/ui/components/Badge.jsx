import './Badge.css'

export default function Badge({ tone = 'green', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
