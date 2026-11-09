import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class OrdersError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new OrdersError(typeof message === 'string' ? message : 'Orders could not be loaded.')
}

export async function fetchAdminOrders(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/orders.php`, { params })
    return Array.isArray(data?.orders) ? data.orders : []
  } catch (error) {
    fail(error)
  }
}

export async function fetchAdminOrder(orderId) {
  try {
    const { data } = await axios.get(`${base}/api/admin/orders.php`, { params: { id: orderId } })
    return data
  } catch (error) {
    fail(error)
  }
}

export async function updateAdminOrderStatus(orderId, status, note = '', deliveryDate = '') {
  try {
    const { data } = await axios.post(`${base}/api/admin/orders.php`, {
      action: 'set-status',
      orderId,
      status,
      note,
      ...(deliveryDate ? { deliveryDate } : {}),
    })
    return data?.order || null
  } catch (error) {
    fail(error)
  }
}

export function adminOrdersCsvUrl(params = {}) {
  const q = new URLSearchParams({ ...params, format: 'csv' })
  return `${base}/api/admin/orders.php?${q.toString()}`
}
