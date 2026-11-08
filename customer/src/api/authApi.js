import axios from 'axios'

const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'rudras.session'

export class AuthError extends Error {
  constructor(message, fields = {}, code = '') {
    super(message)
    this.fields = fields
    this.code = code
  }
}

export function authToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function storeToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function headers() {
  const token = authToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(method, path, body) {
  try {
    const { data } = await axios.request({
      url: `${base}${path}`,
      method,
      data: body,
      headers: headers(),
    })
    return data
  } catch (error) {
    const data = error?.response?.data
    let message = typeof data?.message === 'string' ? data.message : ''
    if (!message) {
      const offline = !error?.response || error?.code === 'ERR_NETWORK'
      message = offline
        ? 'Cannot reach the account service. Start the API from the backend folder and set VITE_API_URL in customer/.env.local.'
        : 'The account service is unavailable.'
    }
    const fields = data?.errors && typeof data.errors === 'object' ? data.errors : {}
    throw new AuthError(message, fields, typeof data?.code === 'string' ? data.code : '')
  }
}

export function loadAuthConfig() {
  return request('GET', '/api/auth/config.php')
}

export function requestSignupCode(email) {
  return request('POST', '/api/auth/signup-code.php', { email })
}

export function verifySignupCode(challengeId, code) {
  return request('POST', '/api/auth/signup-verify.php', { challengeId, code })
}

export function registerAccount(payload) {
  return request('POST', '/api/auth/register.php', payload)
}

export function loginAccount(email, password) {
  return request('POST', '/api/auth/login.php', { email, password })
}

export function confirmOtp(challengeId, code) {
  return request('POST', '/api/auth/otp.php', { challengeId, code })
}

export function logoutAccount() {
  return request('POST', '/api/auth/logout.php', {})
}

export function loadSession() {
  return request('GET', '/api/auth/session.php')
}

export function forgotPassword(email) {
  return request('POST', '/api/auth/forgot-password.php', { email })
}

export function resetPassword(token, password) {
  return request('POST', '/api/auth/reset-password.php', { token, password })
}

export function verifyEmail(token) {
  return request('POST', '/api/auth/verify-email.php', { token })
}

export function resendVerification(email) {
  return request('POST', '/api/auth/resend-verification.php', { email })
}

export function updateProfile(payload) {
  return request('POST', '/api/auth/profile.php', payload)
}

export function changePassword(currentPassword, password) {
  return request('POST', '/api/auth/password.php', { currentPassword, password })
}

export function saveAccountAddress(address) {
  return request('POST', '/api/addresses.php', { action: 'save', address })
}

export function deleteAccountAddress(id) {
  return request('POST', '/api/addresses.php', { action: 'delete', id })
}

export function defaultAccountAddress(id) {
  return request('POST', '/api/addresses.php', { action: 'default', id })
}
