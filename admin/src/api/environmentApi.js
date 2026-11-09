import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class EnvironmentApiError extends Error {}

export function loadEnvironmentOverview() {
  return axios
    .get(`${base}/api/admin/environment.php`)
    .then(({ data }) => data?.overview || null)
    .catch((error) => {
      const message = error?.response?.data?.message
      throw new EnvironmentApiError(typeof message === 'string' ? message : 'Environment overview could not be loaded.')
    })
}
