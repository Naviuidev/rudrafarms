import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class FarmDataError extends Error {}

export const farmKinds = [
  { id: 'users', label: 'Users' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'units', label: 'Units' },
  { id: 'orders', label: 'Orders' },
  { id: 'delivery-boys', label: 'Delivery boys' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'coupons', label: 'Coupons' },
]

export function farmKind(value) {
  return farmKinds.some((kind) => kind.id === value) ? value : 'users'
}

async function post(body) {
  try {
    const { data } = await axios.post(`${base}/api/admin/farm-data.php`, body)
    return data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new FarmDataError(typeof message === 'string' ? message : 'Farm data could not be loaded.')
  }
}

export function listFarmData(kind, password) {
  return post({ action: 'list', kind, password })
}

export function deleteFarmRow(kind, id, password) {
  return post({ action: 'delete', kind, id, password })
}

export function deleteFarmKind(kind, password) {
  return post({ action: 'delete-all', kind, password })
}
