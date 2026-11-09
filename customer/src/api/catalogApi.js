import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'
import { authToken } from './authApi.js'

const base = getApiBase()

export class CatalogError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new CatalogError(typeof message === 'string' ? message : fallback)
}

export async function loadCatalog() {
  try {
    const { data } = await axios.get(`${base}/api/catalog.php`)
    return {
      categories: Array.isArray(data?.categories) ? data.categories : [],
      products: Array.isArray(data?.products) ? data.products : [],
    }
  } catch (error) {
    fail(error, 'The product catalog is unavailable.')
  }
}

export async function fetchWishlist() {
  try {
    const { data } = await axios.post(`${base}/api/catalog/wishlist.php`, { action: 'list' }, {
      headers: { Authorization: `Bearer ${authToken()}` },
    })
    return Array.isArray(data?.productIds) ? data.productIds : []
  } catch (error) {
    fail(error, 'The wishlist is unavailable.')
  }
}

export async function changeWishlist(action, productId) {
  try {
    const { data } = await axios.post(`${base}/api/catalog/wishlist.php`, { action, productId }, {
      headers: { Authorization: `Bearer ${authToken()}` },
    })
    return Array.isArray(data?.productIds) ? data.productIds : []
  } catch (error) {
    fail(error, 'The wishlist could not be updated.')
  }
}
