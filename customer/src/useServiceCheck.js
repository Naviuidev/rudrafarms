import { useEffect, useState } from 'react'
import { checkServiceability } from './api/locationApi.js'

export function useServiceCheck(address, purpose) {
  const latitude = address?.latitude
  const longitude = address?.longitude
  const pin = address?.pin || ''
  const pointKey = latitude == null || longitude == null ? '' : `${address.id}:${latitude},${longitude}:${pin}:${purpose}`
  const [checked, setChecked] = useState({ pointKey: '', service: null, error: '' })

  useEffect(() => {
    if (!pointKey) return undefined
    let cancel = false
    checkServiceability({ latitude, longitude, pin }, purpose).then((service) => {
      if (!cancel) setChecked({ pointKey, service, error: '' })
    }).catch((reason) => {
      if (!cancel) {
        setChecked({
          pointKey,
          service: null,
          error: reason instanceof Error ? reason.message : 'The store could not check this location.',
        })
      }
    })
    return () => {
      cancel = true
    }
  }, [pointKey, latitude, longitude, pin, purpose])

  const checking = pointKey !== '' && checked.pointKey !== pointKey
  return {
    service: checking ? null : checked.service,
    checking,
    error: checking ? '' : checked.error,
  }
}
