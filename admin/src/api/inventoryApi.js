import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class InventoryError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new InventoryError(typeof message === 'string' ? message : 'Inventory request failed.')
}

export async function fetchMovements(params = {}) {
  try {
    const { data } = await axios.get(`${base}/api/admin/inventory.php`, { params })
    return {
      movements: Array.isArray(data?.movements) ? data.movements : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function adjustStock(body) {
  try {
    const { data } = await axios.post(`${base}/api/admin/inventory.php`, { action: 'adjust', ...body })
    return data
  } catch (error) {
    fail(error)
  }
}
