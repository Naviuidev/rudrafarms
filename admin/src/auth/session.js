const storageKey = 'rff-admin-session'
const username = '@Farmfresh'
const password = 'Hosur@1998'

export function adminSignedIn() {
  try {
    return localStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

export function signInAdmin(name, secret) {
  if (name.trim() !== username || secret !== password) return false
  localStorage.setItem(storageKey, '1')
  return true
}

export function signOutAdmin() {
  localStorage.removeItem(storageKey)
}
