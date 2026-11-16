import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export async function loadPublicFaqs() {
  try {
    const { data } = await axios.get(`${base}/api/faqs.php`)
    return Array.isArray(data?.faqs) ? data.faqs : []
  } catch {
    return []
  }
}
