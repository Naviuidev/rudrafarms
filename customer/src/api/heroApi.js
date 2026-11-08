import axios from 'axios'

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

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
