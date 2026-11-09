const DEFAULT_LOCAL = 'http://localhost:8000'
const DEFAULT_PROD = 'https://api.rudrasfarmfresh.in'

function runningOnLocalhost() {
  if (typeof window === 'undefined') {
    return import.meta.env.MODE !== 'production'
  }
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** API origin for customer/admin (matches backend LOCAL_APP_URL / PROD_APP_URL). */
export function getApiBase() {
  if (!runningOnLocalhost()) {
    return DEFAULT_PROD
  }

  const fromBuild = import.meta.env.VITE_API_URL
  if (typeof fromBuild === 'string' && fromBuild.trim() !== '') {
    return fromBuild.replace(/\/$/, '')
  }

  return DEFAULT_LOCAL
}

export function apiUnreachableMessage() {
  if (import.meta.env.PROD) {
    return `Cannot reach the account service. Confirm the API is running at ${DEFAULT_PROD} and try again.`
  }
  return `Cannot reach the account service. Start the API from the backend folder (php -S 127.0.0.1:8000 router.php) and set LOCAL_APP_URL in the project root .env.`
}
