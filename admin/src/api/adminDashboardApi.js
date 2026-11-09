import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class AdminDashboardError extends Error {}

export async function fetchAdminDashboard(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/dashboard.php`, { params })
    return data
  } catch (error) {
    const message = error?.response?.data?.message
    throw new AdminDashboardError(typeof message === 'string' ? message : 'Dashboard could not be loaded.')
  }
}
