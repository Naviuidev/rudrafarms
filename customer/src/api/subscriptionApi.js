import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'
import { authToken } from './authApi.js'

const base = getApiBase()

export class SubscriptionApiError extends Error {
  constructor(message, fields = {}) {
    super(message)
    this.fields = fields
  }
}

function headers() {
  const token = authToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function request(method, path, { params, body } = {}) {
  try {
    const { data } = await axios.request({
      url: `${base}${path}`,
      method,
      params,
      data: body,
      headers: headers(),
    })
    return data
  } catch (error) {
    const data = error?.response?.data
    const message = typeof data?.message === 'string' ? data.message : 'Request failed.'
    const fields = data?.errors && typeof data.errors === 'object' ? data.errors : {}
    throw new SubscriptionApiError(message, fields)
  }
}

export function fetchSubscriptionCatalog() {
  return request('GET', '/api/subscriptions.php')
}

export function fetchSubscriptionDetail(id) {
  return request('GET', '/api/subscriptions.php', { params: { id } })
}

export function quoteSubscription(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'quote', ...payload } })
}

export function startSubscription(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'start', ...payload } })
}

export function renewSubscription(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'renew', ...payload } })
}

export function pauseSubscription(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'pause', ...payload } })
}

export function resumeSubscription(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'resume', ...payload } })
}

export function skipSubscriptionDelivery(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'skip', ...payload } })
}

export function withdrawSkippedDelivery(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'withdraw-skip', ...payload } })
}

export function sendPauseQuery(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'pause-query', ...payload } })
}

export function cancelSubscription(payload) {
  return request('POST', '/api/subscriptions.php', { body: { action: 'cancel', ...payload } })
}
