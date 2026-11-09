import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class CustomersError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new CustomersError(typeof message === 'string' ? message : 'Customers could not be loaded.')
}

export async function fetchAdminCustomers(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/customers.php`, { params })
    return Array.isArray(data?.customers) ? data.customers : []
  } catch (error) {
    fail(error)
  }
}

export async function fetchAdminCustomer(customerId) {
  try {
    const { data } = await axios.get(`${base}/api/admin/customers.php`, { params: { id: customerId } })
    return data
  } catch (error) {
    fail(error)
  }
}
