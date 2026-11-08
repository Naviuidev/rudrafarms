import { useEffect, useRef } from 'react'

/** Re-run a loader on an interval while the tab is visible. */
export function useLiveRefresh(load, intervalMs = 15000) {
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return
      loadRef.current()
    }
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
}
