import { useId } from 'react'
import './TextField.css'

function describedBy(id, hint, error) {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
}

export function TextField({
  id,
  label,
  hint,
  error,
  required = false,
  multiline = false,
  rows = 4,
  className = '',
  ...props
}) {
  const autoId = useId()
  const fieldId = id || autoId
  const shared = {
    id: fieldId,
    required,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy(fieldId, hint, error),
    ...props,
  }

  return (
    <div className={`field${error ? ' field--error' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {multiline ? <textarea rows={rows} {...shared} /> : <input {...shared} />}
      {hint ? <p id={`${fieldId}-hint`} className="field__hint">{hint}</p> : null}
      {error ? <p id={`${fieldId}-error`} className="field__error" role="alert">{error}</p> : null}
    </div>
  )
}

export function SelectField({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children,
  ...props
}) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className={`field${error ? ' field--error' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={fieldId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...props}
      >
        {children}
      </select>
      {hint ? <p id={`${fieldId}-hint`} className="field__hint">{hint}</p> : null}
      {error ? <p id={`${fieldId}-error`} className="field__error" role="alert">{error}</p> : null}
    </div>
  )
}
