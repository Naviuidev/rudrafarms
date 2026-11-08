import axios from 'axios'

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

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
