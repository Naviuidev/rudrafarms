import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export async function fetchPlans() {
  const { data } = await axios.get(`${base}/api/admin/subscription-plans.php`)
  return data.plans || []
}

export async function savePlan(plan) {
  const { data } = await axios.post(`${base}/api/admin/subscription-plans.php`, {
    action: 'save',
    plan,
  })
  return data
}

export async function deletePlan(id) {
  const { data } = await axios.post(`${base}/api/admin/subscription-plans.php`, {
    action: 'delete',
    id,
  })
  return data
}
