import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { blankQuote, quoteCart } from '../api/cartApi.js'
import { patchQuoteForItems } from '../lib/quoteDisplay.js'
import { changeWishlist, fetchWishlist } from '../api/catalogApi.js'
import { checkServiceability, fetchServiceLocations, resolveLocation } from '../api/locationApi.js'
import { loadDeliveryMode, loadDeliveryPoint, saveDeliveryMode, saveDeliveryPoint } from '../lib/deliveryPoint.js'
import { pointFromServiceLocation } from '../lib/locationPoint.js'
import {
  authToken,
  changePassword as changePasswordRequest,
  confirmOtp as confirmOtpRequest,
  defaultAccountAddress,
  deleteAccountAddress,
  loadSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveAccountAddress,
  storeToken,
  updateProfile as updateProfileRequest,
} from '../api/authApi.js'
import { ShopContext } from './shopContext.js'

const STORAGE_KEY = 'rudras.addresses'
const WISH_KEY = 'rudras.wishlist'
const CART_KEY = 'rudras.cart'
const COUPON_KEY = 'rudras.coupon'
const DELIVERY_LOCATION_KEY = 'rudras.deliveryLocation'

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item.productId !== 'string' || typeof item.variantId !== 'string') return []
      const qty = Number(item.qty)
      if (!Number.isInteger(qty) || qty < 1) return []
      const deliveryMode = item.deliveryMode === 'subscription' ? 'subscription' : 'quick'
      return [{
        key: `${item.productId}:${item.variantId}:${deliveryMode}`,
        productId: item.productId,
        variantId: item.variantId,
        deliveryMode,
        qty: Math.min(qty, 12),
      }]
    })
  } catch {
    return []
  }
}

function loadGuestWishlist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WISH_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function mergedWishlist() {
  let ids = await fetchWishlist()
  if (ids.length === 0) {
    for (const id of loadGuestWishlist()) {
      try {
        ids = await changeWishlist('add', id)
      } catch {
        // A saved product may have left the catalog.
      }
    }
  }
  return ids
}

function loadAddresses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return normalize(parsed.filter((item) => item && typeof item.id === 'string' && typeof item.line1 === 'string'))
  } catch {
    return []
  }
}

function normalize(list) {
  if (!list.length) return []
  let seen = false
  const next = list.map((item) => {
    if (!item.isDefault || seen) return { ...item, isDefault: false }
    seen = true
    return { ...item, isDefault: true }
  })
  if (!seen) next[0] = { ...next[0], isDefault: true }
  return next
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `addr-${Date.now()}`
}

function addressRecord(draft, id, isDefault) {
  return {
    id,
    line1: draft.line1.trim(),
    line2: (draft.line2 || '').trim(),
    landmark: (draft.landmark || '').trim(),
    city: draft.city.trim(),
    state: draft.state,
    pin: draft.pin,
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
    type: draft.type || 'home',
    contactName: draft.contactName.trim(),
    contactPhone: draft.contactPhone,
    isDefault,
  }
}

export default function ShopProvider({ children }) {
  const [items, setItems] = useState(loadCart)
  const [coupon, setCoupon] = useState(() => (localStorage.getItem(COUPON_KEY) || '').trim().toUpperCase())
  const [quote, setQuote] = useState(blankQuote)
  const [quoteStatus, setQuoteStatus] = useState('idle')
  const [quoteError, setQuoteError] = useState('')
  const [wishlist, setWishlist] = useState(loadGuestWishlist)
  const [addresses, setAddresses] = useState(loadAddresses)
  const [account, setAccount] = useState(null)
  const [authReady, setAuthReady] = useState(() => !authToken())
  const [serviceLocations, setServiceLocations] = useState([])
  const [deliveryLocationId, setDeliveryLocationId] = useState(
    () => localStorage.getItem(DELIVERY_LOCATION_KEY) || '',
  )
  const [locationsReady, setLocationsReady] = useState(false)
  const [deliveryPoint, setDeliveryPointState] = useState(loadDeliveryPoint)
  const [deliveryMode, setDeliveryModeState] = useState(loadDeliveryMode)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)

  const setDeliveryPoint = useCallback((point, { mode = 'quick' } = {}) => {
    if (!point) {
      saveDeliveryPoint(null)
      setDeliveryPointState(null)
      return
    }
    const next = {
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      pin: typeof point.pin === 'string' ? point.pin : '',
      label: typeof point.label === 'string' ? point.label : '',
    }
    saveDeliveryPoint(next)
    setDeliveryPointState(next)
    saveDeliveryMode(mode)
    setDeliveryModeState(mode)
  }, [])

  const openLocationSheet = useCallback(() => setLocationSheetOpen(true), [])
  const closeLocationSheet = useCallback(() => setLocationSheetOpen(false), [])

  const applyDeliveryFromGps = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Allow location in the browser, or enter a PIN code.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const resolved = await resolveLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          if (!resolved?.found) {
            reject(new Error(resolved?.message || 'Could not place this location.'))
            return
          }
          const service = await checkServiceability(
            { latitude: resolved.latitude, longitude: resolved.longitude, pin: resolved.pin || '' },
            'checkout',
          )
          if (!service.allowed) {
            reject(new Error(service.message || 'We deliver only in Visakhapatnam (Vizag).'))
            return
          }
          const label = [resolved.city, resolved.pin].filter(Boolean).join(', ')
          setDeliveryPoint({
            latitude: resolved.latitude,
            longitude: resolved.longitude,
            pin: resolved.pin || '',
            label,
          })
          resolve()
        } catch (reason) {
          reject(reason instanceof Error ? reason : new Error('Could not use your location.'))
        }
      },
      () => reject(new Error('Location permission is needed, or enter a PIN code.')),
    )
  }), [setDeliveryPoint])

  useEffect(() => {
    let cancel = false
    fetchServiceLocations().then((locations) => {
      if (cancel) return
      setServiceLocations(locations)
      setDeliveryLocationId((current) => {
        if (current && locations.some((entry) => entry.id === current)) return current
        return locations[0]?.id || ''
      })
      setLocationsReady(true)
    }).catch(() => {
      if (!cancel) setLocationsReady(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (deliveryLocationId) localStorage.setItem(DELIVERY_LOCATION_KEY, deliveryLocationId)
  }, [deliveryLocationId])

  useEffect(() => {
    if (!authToken()) return undefined
    let cancel = false
    loadSession().then(async (session) => {
      if (cancel) return
      setAccount(session.customer)
      setAddresses(normalize(session.addresses || []))
      try {
        const ids = await mergedWishlist()
        if (!cancel) setWishlist(ids)
      } catch {
        if (!cancel) setWishlist(loadGuestWishlist())
      }
    }).catch(() => {
      if (!cancel) storeToken('')
    }).finally(() => {
      if (!cancel) setAuthReady(true)
    })
    return () => {
      cancel = true
    }
  }, [])

  const defaultAddress = addresses.find((item) => item.isDefault) || null
  const deliveryLocation = serviceLocations.find((entry) => entry.id === deliveryLocationId) || null
  const pricingPoint = useMemo(() => {
    if (
      deliveryMode === 'saved'
      && defaultAddress
      && Number.isFinite(defaultAddress.latitude)
      && Number.isFinite(defaultAddress.longitude)
    ) {
      return {
        latitude: defaultAddress.latitude,
        longitude: defaultAddress.longitude,
        pin: defaultAddress.pin,
      }
    }
    if (deliveryPoint) {
      return {
        latitude: deliveryPoint.latitude,
        longitude: deliveryPoint.longitude,
        pin: deliveryPoint.pin || '',
      }
    }
    if (defaultAddress && Number.isFinite(defaultAddress.latitude) && Number.isFinite(defaultAddress.longitude)) {
      return {
        latitude: defaultAddress.latitude,
        longitude: defaultAddress.longitude,
        pin: defaultAddress.pin,
      }
    }
    const fromLocation = pointFromServiceLocation(deliveryLocation)
    if (fromLocation) return fromLocation
    return { latitude: undefined, longitude: undefined, pin: '' }
  }, [deliveryLocation, defaultAddress, deliveryPoint, deliveryMode])

  const deliverySummary = useMemo(() => {
    if (deliveryMode === 'saved' && defaultAddress?.line1) {
      const primary = [defaultAddress.city, defaultAddress.pin].filter(Boolean).join(', ') || 'Saved address'
      return { primary, secondary: defaultAddress.line1, mode: 'saved' }
    }
    if (deliveryPoint?.label) {
      return {
        primary: deliveryPoint.label,
        secondary: deliveryPoint.pin ? `PIN ${deliveryPoint.pin}` : '',
        mode: 'quick',
      }
    }
    if (defaultAddress?.line1) {
      const primary = [defaultAddress.city, defaultAddress.pin].filter(Boolean).join(', ') || 'Saved address'
      return { primary, secondary: defaultAddress.line1, mode: 'saved' }
    }
    if (deliveryLocation) {
      return {
        primary: deliveryLocation.name,
        secondary: [deliveryLocation.city, deliveryLocation.state].filter(Boolean).join(', '),
        mode: 'zone',
      }
    }
    return { primary: 'Set delivery location', secondary: 'Saved address, GPS or PIN', mode: 'empty' }
  }, [defaultAddress, deliveryPoint, deliveryLocation, deliveryMode])

  const hasDeliverySet = Boolean(
    (deliveryMode === 'saved' && defaultAddress && Number.isFinite(defaultAddress.latitude))
    || deliveryPoint,
  )

  const deliveringAddressId = deliveryMode === 'saved' ? (defaultAddress?.id || '') : ''
  const quotedPrices = useRef({})
  const pricingLat = pricingPoint.latitude
  const pricingLng = pricingPoint.longitude
  const pricingPin = pricingPoint.pin || ''

  const liveQuote = useMemo(
    () => (items.length === 0 ? quote : patchQuoteForItems(quote, items)),
    [items, quote],
  )

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items.map(({ productId, variantId, qty, deliveryMode }) => ({
      productId,
      variantId,
      qty,
      deliveryMode: deliveryMode === 'subscription' ? 'subscription' : 'quick',
    }))))
  }, [items])

  useEffect(() => {
    localStorage.setItem(COUPON_KEY, coupon)
  }, [coupon])

  useEffect(() => {
    if (items.length === 0) return undefined
    let cancel = false
    setQuoteStatus('loading')
    const timer = setTimeout(() => {
      quoteCart({
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          qty: item.qty,
          deliveryMode: item.deliveryMode === 'subscription' ? 'subscription' : 'quick',
          ...(quotedPrices.current[item.key] != null ? { price: quotedPrices.current[item.key] } : {}),
        })),
        coupon,
        ...(account?.id ? { customerId: account.id } : {}),
        latitude: pricingLat,
        longitude: pricingLng,
        pin: pricingPin,
      }).then((next) => {
        if (cancel) return
        const subsOnlyError = 'This product is for a subscription, not a day-to-day order.'
        const onlySubscription = next.items.length > 0
          && next.items.every((line) => !line.ok && line.message === subsOnlyError)
        if (onlySubscription && items.some((item) => item.deliveryMode === 'quick')) {
          setItems((current) => current.map((item) => {
            if (item.deliveryMode !== 'quick') return item
            return {
              ...item,
              deliveryMode: 'subscription',
              key: `${item.productId}:${item.variantId}:subscription`,
            }
          }))
          return
        }
        for (const line of next.items) quotedPrices.current[line.key] = line.price
        setQuote(next)
        setQuoteError('')
        setQuoteStatus('ready')
      }).catch((reason) => {
        if (cancel) return
        setQuoteError(reason instanceof Error ? reason.message : 'The cart could not be priced.')
        setQuoteStatus('error')
      })
    }, 200)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [items, coupon, pricingLat, pricingLng, pricingPin, account?.id])

  function setDeliveryLocation(id) {
    setDeliveryLocationId(id)
  }

  const value = useMemo(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0)

    function commitGuest(next) {
      const normalized = normalize(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
      setAddresses(normalized)
    }

    async function adopt(result) {
      storeToken(result.token)
      setAccount(result.customer)
      let remote = Array.isArray(result.addresses) ? result.addresses : []
      if (remote.length === 0) {
        for (const address of loadAddresses()) {
          const saved = await saveAccountAddress(address)
          remote = saved.addresses || remote
        }
      }
      setAddresses(normalize(remote))
      try {
        setWishlist(await mergedWishlist())
      } catch {
        setWishlist(loadGuestWishlist())
      }
    }

    async function openSession(result) {
      if (result?.token) await adopt(result)
      return result
    }

    function addItem(productId, variantId, deliveryMode = 'quick', qty = 1) {
      if (!productId || !variantId) return
      const mode = deliveryMode === 'subscription' ? 'subscription' : 'quick'
      const amount = Math.min(Math.max(1, Number(qty) || 1), 12)
      const key = `${productId}:${variantId}:${mode}`
      setItems((current) => {
        const existing = current.find((item) => item.key === key)
        if (!existing) return [...current, { key, productId, variantId, deliveryMode: mode, qty: amount }]
        return current.map((item) => (
          item.key === key ? { ...item, qty: Math.min(amount, 12) } : item
        ))
      })
    }

    function setQty(key, qty) {
      setItems((current) => current.flatMap((item) => {
        if (item.key !== key) return [item]
        if (qty < 1) return []
        return [{ ...item, qty: Math.min(qty, 12) }]
      }))
    }

    function applyCoupon(code) {
      setCoupon(String(code || '').trim().toUpperCase())
    }

    function clearCoupon() {
      setCoupon('')
    }

    async function toggleWishlist(productId) {
      if (account) {
        const ids = await changeWishlist(wishlist.includes(productId) ? 'remove' : 'add', productId)
        setWishlist(ids)
        return ids.includes(productId)
      }
      const next = wishlist.includes(productId)
        ? wishlist.filter((id) => id !== productId)
        : [...wishlist, productId]
      localStorage.setItem(WISH_KEY, JSON.stringify(next))
      setWishlist(next)
      return next.includes(productId)
    }

    async function saveAddress(draft) {
      const serviceability = await checkServiceability(draft, 'address')
      const id = draft.id || createId()
      const exists = addresses.some((item) => item.id === id)
      const record = addressRecord(
        draft,
        id,
        exists ? Boolean(addresses.find((item) => item.id === id)?.isDefault) : addresses.length === 0,
      )
      if (account) {
        const saved = await saveAccountAddress(record)
        const list = normalize((saved.addresses || []).map((item) => (
          item.id === (saved.address?.id || id) ? { ...item, serviceability } : item
        )))
        setAddresses(list)
        return list.find((item) => item.serviceability) || { ...record, serviceability }
      }
      const stored = { ...record, serviceability }
      commitGuest(exists ? addresses.map((item) => (item.id === id ? stored : item)) : [...addresses, stored])
      return stored
    }

    async function setDefaultAddress(id) {
      const current = addresses.find((item) => item.id === id)
      if (!current) return
      const serviceability = await checkServiceability(current, 'address')
      saveDeliveryMode('saved')
      setDeliveryModeState('saved')
      if (Number.isFinite(current.latitude) && Number.isFinite(current.longitude)) {
        const label = [current.city, current.pin].filter(Boolean).join(', ')
        setDeliveryPoint({
          latitude: current.latitude,
          longitude: current.longitude,
          pin: current.pin,
          label: label || current.line1,
        }, { mode: 'saved' })
      }
      if (account) {
        const saved = await defaultAccountAddress(id)
        setAddresses(normalize((saved.addresses || []).map((item) => (
          item.id === id ? { ...item, serviceability } : item
        ))))
        return
      }
      commitGuest(addresses.map((item) => (
        item.id === id ? { ...item, isDefault: true, serviceability } : { ...item, isDefault: false }
      )))
    }

    async function deleteAddress(id) {
      if (account) {
        const saved = await deleteAccountAddress(id)
        setAddresses(normalize(saved.addresses || []))
        return
      }
      const remaining = addresses.filter((item) => item.id !== id)
      if (remaining.length && !remaining.some((item) => item.isDefault)) {
        try {
          const serviceability = await checkServiceability(remaining[0], 'address')
          remaining[0] = { ...remaining[0], isDefault: true, serviceability }
        } catch {
          remaining[0] = { ...remaining[0], isDefault: true, serviceability: null }
        }
      }
      commitGuest(remaining)
    }

    async function register(payload) {
      return openSession(await registerAccount(payload))
    }

    async function login(email, password) {
      return openSession(await loginAccount(email, password))
    }

    async function confirmOtp(challengeId, code) {
      return openSession(await confirmOtpRequest(challengeId, code))
    }

    async function logout() {
      try {
        await logoutAccount()
      } catch {
        // The local session is cleared even when the server is unreachable.
      }
      storeToken('')
      setAccount(null)
      setAddresses(loadAddresses())
      setWishlist(loadGuestWishlist())
    }

    async function updateProfile(payload) {
      const result = await updateProfileRequest(payload)
      setAccount(result.customer)
      return result.customer
    }

    async function changePassword(currentPassword, password) {
      const result = await changePasswordRequest(currentPassword, password)
      if (result.token) storeToken(result.token)
      if (result.customer) setAccount(result.customer)
    }

    return {
      items,
      count,
      addItem,
      setQty,
      coupon,
      applyCoupon,
      clearCoupon,
      quote: items.length === 0 ? blankQuote() : liveQuote,
      quoteStatus: items.length === 0 ? 'ready' : quoteStatus,
      quoteError,
      wishlist,
      toggleWishlist,
      addresses,
      defaultAddress,
      deliveryLocation,
      deliveryPoint,
      deliveryMode,
      deliveringAddressId,
      deliverySummary,
      hasDeliverySet,
      serviceLocations,
      locationsReady,
      setDeliveryLocation,
      setDeliveryPoint,
      applyDeliveryFromGps,
      pricingPoint,
      locationSheetOpen,
      openLocationSheet,
      closeLocationSheet,
      saveAddress,
      setDefaultAddress,
      deleteAddress,
      account,
      authReady,
      register,
      login,
      confirmOtp,
      logout,
      updateProfile,
      changePassword,
    }
  }, [
    items,
    coupon,
    liveQuote,
    quoteStatus,
    quoteError,
    wishlist,
    addresses,
    account,
    authReady,
    defaultAddress,
    deliveryLocation,
    deliveryPoint,
    deliveryMode,
    deliveringAddressId,
    deliverySummary,
    hasDeliverySet,
    serviceLocations,
    locationsReady,
    pricingPoint,
    locationSheetOpen,
    setDeliveryPoint,
    applyDeliveryFromGps,
    openLocationSheet,
    closeLocationSheet,
  ])

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}
