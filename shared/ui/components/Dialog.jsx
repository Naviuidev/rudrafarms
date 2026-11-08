import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './Dialog.css'

export default function Dialog({ open, title, onClose, children, className = '', backdropClassName = '' }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const previous = document.activeElement
    const dialog = dialogRef.current
    const focusable = dialog?.querySelector('input, select, textarea') || dialog?.querySelector('button, a')
    focusable?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialog) return

      const items = [...dialog.querySelectorAll('button, input, select, textarea, a')].filter(
        (item) => !item.disabled,
      )
      if (!items.length) return

      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={`dialog-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`} onMouseDown={onClose}>
      <div
        className={`dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
