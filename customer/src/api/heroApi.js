import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export function blankHero() {
  return {
    eyebrow: '',
    title: '',
    description: '',
    primaryCta: { label: '', to: '/subscriptions' },
    secondaryCta: { label: '', to: '/quick-delivery' },
    showHeroImage: true,
    heroImage: '/images/hero.svg',
    heroImageAlt: '',
    backgroundMode: 'none',
    backgroundImage: '',
    sliderImages: ['', '', ''],
    badges: [],
  }
}

export async function loadStorefrontHero() {
  try {
    const { data } = await axios.get(`${base}/api/hero.php`)
    return data?.hero || blankHero()
  } catch {
    return blankHero()
  }
}
