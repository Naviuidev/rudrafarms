/** @returns {'subscription' | 'checkout'} */
export function addressPurpose(from, explicit) {
  if (explicit === 'subscription' || explicit === 'checkout') {
    return explicit
  }
  if (typeof from === 'string' && (from.startsWith('/subscriptions') || from.includes('/subscriptions'))) {
    return 'subscription'
  }
  return 'checkout'
}
