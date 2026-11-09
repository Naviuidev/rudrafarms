import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class LocationRequestError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new LocationRequestError(typeof message === 'string' ? message : fallback)
}

export async function checkServiceability(point, purpose) {
  try {
    const { data } = await axios.post(`${base}/api/serviceability.php`, {
      pin: point.pin || '',
      latitude: point.latitude,
      longitude: point.longitude,
      purpose,
    })
    if (!data?.serviceability) {
      throw new LocationRequestError('The store could not check this location.')
    }
    return data.serviceability
  } catch (error) {
    if (error instanceof LocationRequestError) throw error
    fail(error, 'The store could not check this location.')
  }
}

export async function resolveLocation(payload) {
  try {
    const { data } = await axios.post(`${base}/api/resolve.php`, payload)
    return data
  } catch (error) {
    if (error?.response?.data?.found === false) return error.response.data
    fail(error, 'The store could not place this location.')
  }
}

export async function fetchServiceLocations() {
  try {
    const { data } = await axios.get(`${base}/api/locations.php`)
    return Array.isArray(data?.locations) ? data.locations : []
  } catch (error) {
    fail(error, 'Delivery locations could not be loaded.')
  }
}

export async function searchPlaces(input) {
  try {
    const { data } = await axios.get(`${base}/api/places.php`, { params: { input } })
    return {
      available: Boolean(data?.available),
      suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    }
  } catch (error) {
    fail(error, 'Place search is unavailable right now.')
  }
}
