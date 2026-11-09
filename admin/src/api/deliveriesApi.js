import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class DeliveriesError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new DeliveriesError(typeof message === 'string' ? message : 'Request failed.')
}

export async function fetchDeliveries(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/deliveries.php`, { params })
    return {
      personnel: Array.isArray(data?.personnel) ? data.personnel : [],
      assignments: Array.isArray(data?.assignments) ? data.assignments : [],
    }
  } catch (error) {
    fail(error)
  }
}

/** Pending work: paid quick orders and subscription delivery rows without an assignment. */
export async function fetchPendingDeliveries(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/deliveries.php`, { params: { ...params, pending: '1' } })
    return {
      pendingOrders: Array.isArray(data?.pendingOrders) ? data.pendingOrders : [],
      pendingSubscriptionDeliveries: Array.isArray(data?.pendingSubscriptionDeliveries) ? data.pendingSubscriptionDeliveries : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function fetchUpcomingDeliveries() {
  try {
    const { data } = await axios.get(`${base}/api/admin/deliveries.php`, { params: { upcoming: '1' } })
    return {
      date: typeof data?.date === 'string' ? data.date : '',
      label: typeof data?.label === 'string' ? data.label : '',
      deliveries: Array.isArray(data?.deliveries) ? data.deliveries : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function fetchAssignmentHistory(assignmentId) {
  try {
    const { data } = await axios.get(`${base}/api/admin/deliveries.php`, { params: { history: assignmentId } })
    return Array.isArray(data?.history) ? data.history : []
  } catch (error) {
    fail(error)
  }
}

export async function savePersonnel(personnel) {
  try {
    const { data } = await axios.post(`${base}/api/admin/deliveries.php`, { action: 'save-personnel', personnel })
    return Array.isArray(data?.personnel) ? data.personnel : []
  } catch (error) {
    fail(error)
  }
}

export async function saveAssignment(assignment) {
  try {
    const { data } = await axios.post(`${base}/api/admin/deliveries.php`, { action: 'save-assignment', assignment })
    return Array.isArray(data?.assignments) ? data.assignments : []
  } catch (error) {
    fail(error)
  }
}

export async function setAssignmentStatus(payload) {
  try {
    const { data } = await axios.post(`${base}/api/admin/deliveries.php`, { action: 'set-status', payload })
    return Array.isArray(data?.assignments) ? data.assignments : []
  } catch (error) {
    fail(error)
  }
}
