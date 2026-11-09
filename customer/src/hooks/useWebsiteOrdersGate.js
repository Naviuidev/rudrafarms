import { useEffect, useState } from 'react'
import { fetchStoreHours } from '../api/checkoutApi.js'

/** Polls whether the admin has website checkout open (quick + subscription pay). */
export function useWebsiteOrdersGate() {
  const [acceptingWebsiteOrders, setAcceptingWebsiteOrders] = useState(true)

  useEffect(() => {
    let cancel = false
    function load() {
      return fetchStoreHours().then((result) => {
        if (cancel) return
        setAcceptingWebsiteOrders(result?.hours?.acceptingWebsiteOrders !== false)
      })
    }
    load().catch(() => {})
    const timer = window.setInterval(load, 30000)
    return () => {
      cancel = true
      window.clearInterval(timer)
    }
  }, [])

  return acceptingWebsiteOrders
}
