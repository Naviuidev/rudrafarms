import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'
import { authToken } from './authApi.js'

const base = getApiBase()

export class CheckoutError extends Error {
  constructor(message, fields = {}) {
    super(message)
    this.fields = fields
  }
}

function headers() {
  const token = authToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function request(method, path, { params, body } = {}) {
  try {
    const { data } = await axios.request({
      url: `${base}${path}`,
      method,
      params,
      data: body,
      headers: headers(),
    })
    return data
  } catch (error) {
    const data = error?.response?.data
    const message = typeof data?.message === 'string' ? data.message : 'Checkout is unavailable right now.'
    const fields = data?.errors && typeof data.errors === 'object' ? data.errors : {}
    throw new CheckoutError(message, fields)
  }
}

export function fetchStoreHours() {
  return request('GET', '/api/store-hours.php')
}

export function placeQuickOrder(payload) {
  return request('POST', '/api/checkout/place.php', { body: payload })
}

export function verifyQuickPayment(payload) {
  return request('POST', '/api/checkout/verify.php', { body: payload })
}

export function loadOrders() {
  return request('GET', '/api/orders.php')
}

export function loadOrder(orderId) {
  return request('GET', '/api/orders.php', { params: { id: orderId } })
}

export function requestOrderCancellation(orderId) {
  return request('POST', '/api/order-actions.php', { body: { action: 'request-cancellation', orderId } })
}

export function cancelSubscriptionOrder(orderId, reason) {
  return request('POST', '/api/order-actions.php', { body: { action: 'cancel-subscription', orderId, reason } })
}

export function reorderPreview(orderId) {
  return request('POST', '/api/order-actions.php', { body: { action: 'reorder-preview', orderId } })
}

export function reorderPlace(payload) {
  return request('POST', '/api/order-actions.php', { body: { action: 'reorder', ...payload } })
}

export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is unavailable.'))
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Razorpay could not be loaded.'))
    document.body.appendChild(script)
  })
}

function paymentLanded(result) {
  const order = result?.order
  return Boolean(order && !result.pending && (order.paymentStatus === 'paid' || order.status === 'confirmed'))
}

export async function payWithRazorpay({ payment, orderId, description, prefill }) {
  await loadRazorpayScript()
  return new Promise((resolve, reject) => {
    let settled = false
    let watchTimer = 0
    let graceTimer = 0

    const stop = () => {
      window.clearInterval(watchTimer)
      window.clearInterval(graceTimer)
    }
    const succeed = () => {
      if (settled) return
      settled = true
      stop()
      resolve()
    }
    const fail = (error) => {
      if (settled) return
      settled = true
      stop()
      reject(error)
    }
    const watch = async () => {
      if (settled) return
      try {
        const result = await verifyQuickPayment({ orderId, sync: true })
        if (paymentLanded(result)) succeed()
      } catch {
        // Razorpay has not recorded the scan yet.
      }
    }

    const sandbox = String(payment.keyId || '').startsWith('rzp_test_')
    const checkout = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'RudrasFarmFresh',
      description,
      order_id: payment.orderId,
      prefill: sandbox ? { ...prefill, method: 'upi', vpa: 'success@razorpay' } : prefill,
      retry: { enabled: true, max_count: 3 },
      ...(sandbox ? {} : {
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay by UPI',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true },
          },
        },
      }),
      handler: async (response) => {
        try {
          await verifyQuickPayment({
            orderId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          succeed()
        } catch (error) {
          fail(error instanceof CheckoutError ? error : new CheckoutError('Payment could not be confirmed.'))
        }
      },
      modal: {
        ondismiss() {
          window.clearInterval(watchTimer)
          let tries = 0
          graceTimer = window.setInterval(() => {
            tries += 1
            watch().finally(() => {
              if (!settled && tries >= 8) {
                fail(new CheckoutError('Payment was not received. If the UPI app shows paid, wait a moment and open the order.'))
              }
            })
          }, 2000)
        },
      },
    })
    watchTimer = window.setInterval(watch, 2500)
    checkout.open()
  })
}
