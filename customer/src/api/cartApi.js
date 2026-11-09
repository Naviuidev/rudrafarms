import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class CartError extends Error {}

export function blankQuote() {
  return {
    items: [],
    subtotal: 0,
    discount: 0,
    coupon: { code: '', applied: false, message: '', couponId: '' },
    deliveryFee: 0,
    freeDeliveryMinimum: 0,
    tax: 0,
    payable: 0,
    serviceable: false,
    orderKind: 'quick',
    subscriptionSchedule: '',
    serviceability: { dayToDay: false, subscription: false, message: '' },
  }
}

export async function quoteCart(payload) {
  try {
    const { data } = await axios.post(`${base}/api/cart/quote.php`, payload)
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      subtotal: Number(data?.subtotal) || 0,
      discount: Number(data?.discount) || 0,
      coupon: {
        code: typeof data?.coupon?.code === 'string' ? data.coupon.code : '',
        applied: Boolean(data?.coupon?.applied),
        message: typeof data?.coupon?.message === 'string' ? data.coupon.message : '',
        couponId: typeof data?.coupon?.couponId === 'string' ? data.coupon.couponId : '',
      },
      deliveryFee: Number(data?.deliveryFee) || 0,
      freeDeliveryMinimum: Number(data?.freeDeliveryMinimum) || 0,
      tax: Number(data?.tax) || 0,
      payable: Number(data?.payable) || 0,
      orderKind: typeof data?.orderKind === 'string' ? data.orderKind : 'quick',
      subscriptionSchedule: typeof data?.subscriptionSchedule === 'string' ? data.subscriptionSchedule : '',
      serviceable: Boolean(data?.serviceable),
      serviceability: {
        dayToDay: Boolean(data?.serviceability?.dayToDay),
        subscription: Boolean(data?.serviceability?.subscription),
        message: typeof data?.serviceability?.message === 'string' ? data.serviceability.message : '',
        quickZones: Array.isArray(data?.serviceability?.zones) ? data.serviceability.zones : [],
      },
    }
  } catch (error) {
    const message = error?.response?.data?.message
    throw new CartError(typeof message === 'string' ? message : 'The cart could not be priced.')
  }
}
