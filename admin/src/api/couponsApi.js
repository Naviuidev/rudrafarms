import axios from 'axios'

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export class CouponsError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new CouponsError(typeof message === 'string' ? message : 'Coupons could not be saved.')
}

export async function listCoupons() {
  try {
    const { data } = await axios.get(`${base}/api/admin/coupons.php`)
    return Array.isArray(data?.coupons) ? data.coupons : []
  } catch (error) {
    fail(error)
  }
}

export async function saveCoupon(coupon) {
  try {
    const { data } = await axios.post(`${base}/api/admin/coupons.php`, { action: 'save', coupon })
    return Array.isArray(data?.coupons) ? data.coupons : []
  } catch (error) {
    fail(error)
  }
}

export async function deleteCoupon(id) {
  try {
    const { data } = await axios.post(`${base}/api/admin/coupons.php`, { action: 'delete', id })
    return Array.isArray(data?.coupons) ? data.coupons : []
  } catch (error) {
    fail(error)
  }
}
