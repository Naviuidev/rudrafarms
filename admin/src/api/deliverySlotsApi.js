import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class DeliverySlotsError extends Error {}

function fail(error) {
  const message = error?.response?.data?.message
  throw new DeliverySlotsError(typeof message === 'string' ? message : 'Delivery slots could not be saved.')
}

export async function fetchDeliverySlotConfig() {
  try {
    const { data } = await axios.get(`${base}/api/admin/delivery-slots.php`)
    return {
      settings: data?.settings || null,
      slots: Array.isArray(data?.slots) ? data.slots : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function saveDeliverySlotSettings(settings) {
  try {
    const { data } = await axios.post(`${base}/api/admin/delivery-slots.php`, {
      action: 'save-settings',
      ...settings,
    })
    return {
      settings: data?.settings || null,
      slots: Array.isArray(data?.slots) ? data.slots : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function saveDeliverySlot(slot) {
  try {
    const { data } = await axios.post(`${base}/api/admin/delivery-slots.php`, {
      action: 'save-slot',
      ...slot,
    })
    return {
      settings: data?.settings || null,
      slots: Array.isArray(data?.slots) ? data.slots : [],
    }
  } catch (error) {
    fail(error)
  }
}

export async function deleteDeliverySlot(id) {
  try {
    const { data } = await axios.post(`${base}/api/admin/delivery-slots.php`, {
      action: 'delete-slot',
      id,
    })
    return {
      settings: data?.settings || null,
      slots: Array.isArray(data?.slots) ? data.slots : [],
    }
  } catch (error) {
    fail(error)
  }
}
