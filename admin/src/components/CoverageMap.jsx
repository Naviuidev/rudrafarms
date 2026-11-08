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

function meters(radiusKm) {
  const radius = Number(radiusKm)
  if (!Number.isFinite(radius) || radius <= 0 || radius > 100) return 0
  return radius * 1000
}

export default function CoverageMap({ latitude, longitude, radiusKm }) {
  const nodeRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const covered = meters(radiusKm) > 0

  useEffect(() => {
    const map = L.map(nodeRef.current, { scrollWheelZoom: false }).setView([latitude, longitude], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    mapRef.current = map
    const frame = requestAnimationFrame(() => {
      map.invalidateSize()
      if (circleRef.current) {
        map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] })
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
  }, [latitude, longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined
    const point = [latitude, longitude]
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { icon: pinIcon }).addTo(map)
    } else {
      markerRef.current.setLatLng(point)
    }

    const radius = meters(radiusKm)
    if (radius > 0) {
      if (!circleRef.current) {
        circleRef.current = L.circle(point, {
          radius,
          color: '#228B45',
          fillColor: '#228B45',
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(map)
      } else {
        circleRef.current.setLatLng(point)
        circleRef.current.setRadius(radius)
      }
      map.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] })
    } else if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
      map.setView(point, 14)
    } else {
      map.setView(point, 14)
    }
    map.invalidateSize()
    return undefined
  }, [latitude, longitude, radiusKm])

  return (
    <div className="coverage-map">
      <div
        ref={nodeRef}
        className="coverage-map__canvas"
        role="img"
        aria-label={covered
          ? `Map covering ${radiusKm} kilometres around this PIN.`
          : 'Map centered on this PIN. Enter a radius to draw the coverage.'}
      />
      <p>
        {covered
          ? `The green area covers ${radiusKm} km around this PIN.`
          : 'Enter a radius to draw the coverage around this PIN.'}
      </p>
    </div>
  )
}
