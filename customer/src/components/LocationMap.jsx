import { useEffect, useRef } from 'react'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const fallback = [12.7409, 77.8253]

export default function LocationMap({ latitude, longitude, onPick }) {
  const nodeRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const map = L.map(nodeRef.current, { scrollWheelZoom: false }).setView(fallback, 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    map.on('click', (event) => {
      onPickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || latitude == null || longitude == null) return undefined
    const point = [latitude, longitude]
    if (!markerRef.current) {
      const marker = L.marker(point, { icon: pinIcon, draggable: true }).addTo(map)
      marker.on('dragend', () => {
        const next = marker.getLatLng()
        onPickRef.current({ latitude: next.lat, longitude: next.lng })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng(point)
    }
    map.setView(point, Math.max(map.getZoom(), 14))
    return undefined
  }, [latitude, longitude])

  return (
    <div className="map-panel">
      <div
        ref={nodeRef}
        className="map-panel__canvas"
        role="application"
        aria-label="Map. Click the map or drag the pin to set the delivery point."
      />
      <p>
        {latitude == null
          ? 'Click the map to drop a pin.'
          : `Map point ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`}
      </p>
    </div>
  )
}
