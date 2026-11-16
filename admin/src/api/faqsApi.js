import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class FaqsError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new FaqsError(typeof message === 'string' ? message : fallback)
}

export async function loadAdminFaqs() {
  try {
    const { data } = await axios.get(`${base}/api/admin/faqs.php`)
    return Array.isArray(data?.faqs) ? data.faqs : []
  } catch (error) {
    fail(error, 'FAQs could not be loaded.')
  }
}

export async function saveFaq(faq) {
  try {
    const { data } = await axios.post(`${base}/api/admin/faqs.php`, { action: 'save', faq })
    return Array.isArray(data?.faqs) ? data.faqs : []
  } catch (error) {
    fail(error, 'FAQ could not be saved.')
  }
}

export async function deleteFaq(id) {
  try {
    const { data } = await axios.post(`${base}/api/admin/faqs.php`, { action: 'delete', id })
    return Array.isArray(data?.faqs) ? data.faqs : []
  } catch (error) {
    fail(error, 'FAQ could not be deleted.')
  }
}
