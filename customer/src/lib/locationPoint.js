export function pointFromServiceLocation(location) {
  if (!location) return null
  const center = location.center
  if (center && Number.isFinite(Number(center.latitude)) && Number.isFinite(Number(center.longitude))) {
    const pin = Array.isArray(location.pins) && location.pins[0] ? String(location.pins[0]) : ''
    return {
      latitude: Number(center.latitude),
      longitude: Number(center.longitude),
      pin,
    }
  }
  return null
}
