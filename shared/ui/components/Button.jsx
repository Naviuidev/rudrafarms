import { Link } from 'react-router-dom'
import './Button.css'

export default function Button({
  to,
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  const classes = `btn btn--${variant}${className ? ` ${className}` : ''}`

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
