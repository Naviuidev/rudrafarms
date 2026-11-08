import './ErrorState.css'

export default function ErrorState({ title, message, action }) {
  return (
    <div className="error-card" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </div>
  )
}
