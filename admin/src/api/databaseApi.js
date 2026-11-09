import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class DatabaseConfigError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new DatabaseConfigError(typeof message === 'string' ? message : fallback)
}

export function unlockDatabaseConfig(password) {
  return axios
    .post(`${base}/api/admin/database.php`, { action: 'unlock', password })
    .then(({ data }) => data?.config || null)
    .catch((error) => fail(error, 'Database settings could not be opened.'))
}

export function saveDatabaseConfig({ password, mode, host, port, name, user, dbPassword, clearPassword }) {
  return axios
    .post(`${base}/api/admin/database.php`, {
      action: 'save',
      password,
      mode,
      host,
      port,
      name,
      user,
      dbPassword,
      clearPassword,
    })
    .then(({ data }) => data?.config || null)
    .catch((error) => fail(error, 'Database settings could not be saved.'))
}
