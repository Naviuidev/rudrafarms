import './QuantityStepper.css'

export default function QuantityStepper({ value, onChange, label, min = 1, max = 12, className = '', onClick }) {
  const classes = ['stepper', className].filter(Boolean).join(' ')
  return (
    <div className={classes} role="group" aria-label={label} onClick={onClick}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Reduce ${label}`}>
        −
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}
