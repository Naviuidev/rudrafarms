import axios from 'axios'
import { apiUnreachableMessage, getApiBase } from '@shared/config/apiBase.js'
import { authToken } from './authApi.js'

const base = getApiBase()

export class ContactError extends Error {}

export const CONTACT_TOPICS = [
  { value: 'payment_deducted_no_order', label: 'Payment got deducted but order not placed' },
  { value: 'payment_in_process', label: 'Payment is in process' },
  { value: 'custom', label: 'Custom message' },
]

function headers() {
  const token = authToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new ContactError(typeof message === 'string' && message ? message : fallback)
}

export async function submitContactQuery(payload) {
  try {
    const { data } = await axios.post(`${base}/api/contact.php`, { action: 'submit', ...payload }, { headers: headers() })
    return data?.query || null
  } catch (error) {
    if (!error?.response) throw new ContactError(apiUnreachableMessage())
    fail(error, 'Your message could not be sent.')
  }
}

export async function loadMyContactQueries() {
  try {
    const { data } = await axios.get(`${base}/api/contact-queries.php`, { headers: headers() })
    return Array.isArray(data?.queries) ? data.queries : []
  } catch (error) {
    if (!error?.response) throw new ContactError(apiUnreachableMessage())
    fail(error, 'Support messages could not be loaded.')
  }
}

export async function replyToContactQuery(queryId, message) {
  try {
    const { data } = await axios.post(
      `${base}/api/contact-queries.php`,
      { action: 'reply', queryId, message },
      { headers: headers() },
    )
    return data?.query || null
  } catch (error) {
    if (!error?.response) throw new ContactError(apiUnreachableMessage())
    fail(error, 'Your reply could not be sent.')
  }
}