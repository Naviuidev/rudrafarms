export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/'
  if (/^\/(login|register|account|forgot-password|reset-password|verify-email)(\/|$|\?)/.test(value)) return '/'
  return value
}
