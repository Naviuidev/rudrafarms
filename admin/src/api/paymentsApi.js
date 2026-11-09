import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class PaymentsConfigError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new PaymentsConfigError(typeof message === 'string' ? message : fallback)
}

export function unlockPaymentConfig(password) {
  return axios
    .post(`${base}/api/admin/payments.php`, { action: 'unlock', password })
    .then(({ data }) => data?.config || null)
    .catch((error) => fail(error, 'Payment settings could not be opened.'))
}

export function savePaymentConfig({ password, mode, keyId, keySecret }) {
  return axios
    .post(`${base}/api/admin/payments.php`, {
      action: 'save',
      password,
      mode,
      keyId,
      keySecret,
    })
    .then(({ data }) => data?.config || null)
    .catch((error) => fail(error, 'Payment settings could not be saved.'))
}
