import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class HeroRequestError extends Error {}

async function postHero(body) {
  try {
    const { data } = await axios.post(`${base}/api/admin/hero.php`, body)
    return {
      publishedId: typeof data?.publishedId === 'string' ? data.publishedId : '',
      sections: Array.isArray(data?.sections) ? data.sections : [],
    }
  } catch (error) {
    const message = error?.response?.data?.message
    throw new HeroRequestError(typeof message === 'string' ? message : 'The hero design could not be updated.')
  }
}

export async function loadHeroLibrary() {
  try {
    const { data } = await axios.get(`${base}/api/admin/hero.php`)
    return {
      publishedId: typeof data?.publishedId === 'string' ? data.publishedId : '',
      sections: Array.isArray(data?.sections) ? data.sections : [],
    }
  } catch (error) {
    const message = error?.response?.data?.message
    throw new HeroRequestError(typeof message === 'string' ? message : 'The hero design could not be loaded.')
  }
}

export function saveHeroSection(section) {
  return postHero({ action: 'save', section })
}

export function publishHeroSection(id) {
  return postHero({ action: 'publish', id })
}

export function deleteHeroSection(id) {
  return postHero({ action: 'delete', id })
}

export function createHeroSection(layout = 'split') {
  return postHero({ action: 'create', layout })
}

export { uploadCatalogImage as uploadHeroImage } from './catalogApi.js'
