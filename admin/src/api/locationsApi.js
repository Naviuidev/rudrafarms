import axios from 'axios'

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export class LocationAdminError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new LocationAdminError(typeof message === 'string' ? message : 'The locations could not be saved.')
}

export async function loadLocations() {
  try {
    const { data } = await axios.get(`${base}/api/admin/locations.php`)
    return Array.isArray(data?.locations) ? data.locations : []
  } catch (error) {
    fail(error)
  }
}

export async function saveLocation(location) {
  try {
    const { data } = await axios.post(`${base}/api/admin/locations.php`, { action: 'save', location })
    return Array.isArray(data?.locations) ? data.locations : []
  } catch (error) {
    if (error instanceof LocationAdminError) throw error
    fail(error)
  }
}

export async function resolvePin(pin) {
  try {
    const { data } = await axios.post(`${base}/api/resolve.php`, { pin })
    if (!data?.found) {
      throw new LocationAdminError(typeof data?.message === 'string' ? data.message : 'This PIN could not be found.')
    }
    return data
  } catch (error) {
    if (error instanceof LocationAdminError) throw error
    if (error?.response?.data?.found === false) {
      const message = error.response.data.message
      throw new LocationAdminError(typeof message === 'string' ? message : 'This PIN could not be found.')
    }
    throw new LocationAdminError('This PIN could not be looked up. Try again.')
  }
}

export async function deleteLocation(id) {
  try {
    const { data } = await axios.post(`${base}/api/admin/locations.php`, { action: 'delete', id })
    return Array.isArray(data?.locations) ? data.locations : []
  } catch (error) {
    if (error instanceof LocationAdminError) throw error
    fail(error)
  }
}
