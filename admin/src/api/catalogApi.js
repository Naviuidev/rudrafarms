import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class CatalogAdminError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new CatalogAdminError(typeof message === 'string' ? message : 'The catalog could not be saved.')
}

export async function loadAdminCatalog() {
  try {
    const { data } = await axios.get(`${base}/api/admin/catalog.php`)
    return {
      units: Array.isArray(data?.units) ? data.units : [],
      categories: Array.isArray(data?.categories) ? data.categories : [],
      products: Array.isArray(data?.products) ? data.products : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function uploadCatalogImage(file) {
  try {
    const body = new FormData()
    body.append('image', file)
    const { data } = await axios.post(`${base}/api/admin/upload.php`, body)
    if (typeof data?.path !== 'string' || data.path === '') {
      throw new CatalogAdminError('The image could not be saved.')
    }
    return data.path
  } catch (error) {
    if (error instanceof CatalogAdminError) throw error
    fail(error)
  }
}

export async function saveAdminCatalog(action, body) {
  try {
    const { data } = await axios.post(`${base}/api/admin/catalog.php`, { action, ...body })
    return {
      units: Array.isArray(data?.units) ? data.units : [],
      categories: Array.isArray(data?.categories) ? data.categories : [],
      products: Array.isArray(data?.products) ? data.products : [],
    }
  } catch (error) {
    if (error instanceof CatalogAdminError) throw error
    fail(error)
  }
}
