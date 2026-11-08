import { useCallback, useMemo, useState } from 'react'
import { ToastContext } from '../toastContext.js'
import './Toast.css'

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((toast) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current.slice(-2), { id, tone: 'success', ...toast }])
    window.setTimeout(() => dismiss(id), 4200)
  }, [dismiss])

  const value = useMemo(() => showToast, [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <article key={toast.id} className={`toast toast--${toast.tone}`}>
            <div>
              <strong>{toast.title}</strong>
              {toast.message ? <p>{toast.message}</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              ×
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
