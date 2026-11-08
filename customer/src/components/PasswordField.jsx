import { useState } from 'react'

export default function PasswordField({ id, label, value, error, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={`field field--secret${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>
        {label}
        <span aria-hidden="true"> *</span>
      </label>
      <div className="secret">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="secret__toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? <p id={`${id}-error`} className="field__error" role="alert">{error}</p> : null}
    </div>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 4l16 16M9.5 9.8A3 3 0 0 0 12 15a3 3 0 0 0 2.2-.9M6.2 6.7C4.2 8.1 2.5 12 2.5 12S6 17.5 12 17.5c1.4 0 2.6-.3 3.7-.8M10.2 6.7A10 10 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a16 16 0 0 1-3.2 3.6" />
    </svg>
  )
}
