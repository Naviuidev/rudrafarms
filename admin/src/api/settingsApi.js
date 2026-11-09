import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class SettingsError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new SettingsError(typeof message === 'string' ? message : fallback)
}

export async function fetchSettings() {
  try {
    const { data } = await axios.get(`${base}/api/admin/settings.php`)
    return {
      hours: data?.hours || null,
      store: data?.store || null,
    }
  } catch (error) {
    fail(error, 'Settings could not be loaded.')
  }
}

export async function fetchStoreHours() {
  const settings = await fetchSettings()
  return settings?.hours || null
}

export async function saveStoreHours(open, close) {
  try {
    const { data } = await axios.post(`${base}/api/admin/settings.php`, {
      action: 'save-hours',
      open,
      close,
    })
    return data?.hours || null
  } catch (error) {
    fail(error, 'Store hours could not be saved.')
  }
}

export async function setWebsiteOrdersAccepting(accepting) {
  try {
    const { data } = await axios.post(`${base}/api/admin/settings.php`, {
      action: 'set-website-orders',
      accepting: Boolean(accepting),
    })
    return data?.hours || null
  } catch (error) {
    fail(error, 'Website orders could not be updated.')
  }
}

export async function saveStoreProfile(storeName, supportEmail, minimum) {
  try {
    const { data } = await axios.post(`${base}/api/admin/settings.php`, {
      action: 'save-store',
      storeName,
      supportEmail,
      minimum,
    })
    return data?.store || null
  } catch (error) {
    fail(error, 'Store name could not be saved.')
  }
}

export async function openMailSettings(password) {
  try {
    const { data } = await axios.post(`${base}/api/admin/settings.php`, {
      action: 'open-mail',
      password,
    })
    return {
      mail: data?.mail || null,
      store: data?.store || null,
    }
  } catch (error) {
    fail(error, 'Email config could not be opened.')
  }
}

export async function saveMailSettings(email, appPassword, fromName, password) {
  try {
    const { data } = await axios.post(`${base}/api/admin/settings.php`, {
      action: 'save-mail',
      email,
      appPassword,
      fromName,
      password,
    })
    return data?.mail || null
  } catch (error) {
    fail(error, 'Email config could not be saved.')
  }
}
