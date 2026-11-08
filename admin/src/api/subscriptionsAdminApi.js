import axios from 'axios'

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export class SubscriptionsAdminError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new SubscriptionsAdminError(typeof message === 'string' ? message : 'Subscriptions could not be loaded.')
}

export async function fetchAdminSubscriptions(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/subscriptions.php`, { params })
    return {
      subscriptions: Array.isArray(data?.subscriptions) ? data.subscriptions : [],
      renewals: Array.isArray(data?.renewals) ? data.renewals : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function setAdminSubscriptionStatus(id, status) {
  try {
    await axios.post(`${base}/api/admin/subscriptions.php`, { action: 'set-status', id, status })
  } catch (error) {
    fail(error)
  }
}
