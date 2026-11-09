const KEY = 'rudras.deliveryPoint'
const MODE_KEY = 'rudras.deliveryMode'

export function loadDeliveryMode() {
  return localStorage.getItem(MODE_KEY) === 'quick' ? 'quick' : 'saved'
}

export function saveDeliveryMode(mode) {
  localStorage.setItem(MODE_KEY, mode === 'quick' ? 'quick' : 'saved')
}

export function loadDeliveryPoint() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const point = JSON.parse(raw)
    if (!point || !Number.isFinite(Number(point.latitude)) || !Number.isFinite(Number(point.longitude))) {
      return null
    }
    return {
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      pin: typeof point.pin === 'string' ? point.pin : '',
      label: typeof point.label === 'string' ? point.label : '',
    }
  } catch {
    return null
  }
}

export function saveDeliveryPoint(point) {
  if (!point) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(KEY, JSON.stringify({
    latitude: point.latitude,
    longitude: point.longitude,
    pin: point.pin || '',
    label: point.label || '',
  }))
}
