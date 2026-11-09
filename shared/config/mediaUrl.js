import { getApiBase } from './apiBase.js'

/** Bundled in customer build (shop domain). Admin uploads use random hex names under /images/. */
const BUNDLED_IMAGE = new Set([
  'buffalo-milk.svg',
  'cow-milk.svg',
  'curd.svg',
  'eggs.svg',
  'hero.svg',
  'honey.svg',
  'mango.svg',
  'palak.svg',
  'paneer.svg',
])

function fileName(path) {
  const parts = String(path).split('/').filter(Boolean)
  return (parts[parts.length - 1] || '').toLowerCase()
}

/** Paths saved by admin upload.php (16-char hex + extension). */
function isUploadedImagePath(path) {
  const name = fileName(path)
  if (/^[0-9a-f]{16}\.(jpe?g|png|webp|svg)$/i.test(name)) {
    return true
  }
  return name !== '' && !BUNDLED_IMAGE.has(name)
}

/**
 * Product/category paths from the API are usually "/images/…".
 * Uploads are stored under the API public folder; the shop build only ships seed SVGs.
 */
export function mediaUrl(path) {
  if (path == null || path === '') return ''
  const trimmed = String(path).trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (!normalized.startsWith('/images/')) return normalized
  if (!isUploadedImagePath(normalized)) return normalized

  return `${getApiBase()}${normalized}`
}
