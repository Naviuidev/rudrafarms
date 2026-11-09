import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { useToast } from '@brand/toastContext.js'
import { useShop } from '../context/shopContext.js'
import ServiceabilityStatus from './ServiceabilityStatus.jsx'

const typeLabels = { home: 'Home', work: 'Work', other: 'Other' }

export default function AddressBook({ onDone, picker = false, deliverySelect = false }) {
  const { addresses, setDefaultAddress, deleteAddress, deliveringAddressId, deliveryMode, openLocationSheet } = useShop()
  const place = useLocation()
  const showToast = useToast()
  const [pendingId, setPendingId] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [error, setError] = useState('')
  const canPick = picker || deliverySelect

  function isDelivering(address) {
    return deliveryMode === 'saved' && deliveringAddressId === address.id
  }

  async function deliverHere(address) {
    setError('')
    setPendingId(address.id)
    try {
      await setDefaultAddress(address.id)
      showToast({
        title: 'Delivery address updated',
        message: `${address.line1} is shown in the header and used for pricing.`,
      })
      onDone?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This address could not be selected.')
    } finally {
      setPendingId('')
    }
  }

  async function remove(address) {
    setError('')
    setPendingId(address.id)
    try {
      await deleteAddress(address.id)
      setConfirmId('')
      showToast({ title: 'Address deleted', message: address.line1 })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This address could not be deleted.')
    } finally {
      setPendingId('')
    }
  }

  if (addresses.length === 0) {
    return (
      <EmptyState
        title="No delivery address yet"
        message="Add an address, or use GPS / PIN from Deliver to in the header."
        action={(
          <>
            <Button to="/addresses/new" state={{ from: `${place.pathname}${place.search}` }} onClick={onDone}>Add address</Button>
            {deliverySelect ? (
              <Button type="button" variant="outline" onClick={() => { openLocationSheet(); onDone?.() }}>Use GPS or PIN</Button>
            ) : null}
          </>
        )}
      />
    )
  }

  async function pickAddress(address) {
    if (isDelivering(address)) {
      onDone?.()
      return
    }
    await deliverHere(address)
  }

  return (
    <div className="address-book">
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {deliverySelect ? (
        <p className="subs-muted address-book__hint">
          Choose <strong>Deliver here</strong> or tap a card. The same address appears under <strong>Deliver to</strong> in the header.
          {' '}
          <button type="button" className="text-button" onClick={openLocationSheet}>Change with GPS or PIN</button>
        </p>
      ) : null}
      <ul className={`address-list${canPick ? ' address-list--picker' : ''}`}>
        {addresses.map((address) => {
          const delivering = isDelivering(address)
          const cardClass = delivering
            ? 'address-card address-card--default address-card--delivering'
            : address.isDefault
              ? 'address-card address-card--default'
              : 'address-card'
          return (
            <li key={address.id} className={cardClass}>
              {canPick ? (
                <button
                  type="button"
                  className="address-picker"
                  disabled={pendingId === address.id}
                  onClick={() => pickAddress(address)}
                >
                  <p className="eyebrow">
                    {typeLabels[address.type] || 'Address'}
                    {delivering ? ' · Delivering here' : address.isDefault ? ' · Default' : ''}
                  </p>
                  <h3>{address.line1}</h3>
                  <p>
                    {[address.line2, address.landmark, address.city, address.state, address.pin].filter(Boolean).join(', ')}
                  </p>
                  <p>{address.contactName} · {address.contactPhone}</p>
                  <ServiceabilityStatus service={address.serviceability} />
                </button>
              ) : (
                <>
                  <p className="eyebrow">
                    {typeLabels[address.type] || 'Address'}
                    {delivering ? ' · Delivering here' : address.isDefault ? ' · Default' : ''}
                  </p>
                  <h3>{address.line1}</h3>
                  <p>
                    {[address.line2, address.landmark, address.city, address.state, address.pin].filter(Boolean).join(', ')}
                  </p>
                  <p>{address.contactName} · {address.contactPhone}</p>
                  <ServiceabilityStatus service={address.serviceability} />
                  <div className="address-card__actions">
                    {delivering ? (
                      <span className="address-card__badge" role="status">Current delivery</span>
                    ) : (
                      <Button variant="outline" disabled={pendingId === address.id} onClick={() => deliverHere(address)}>
                        Deliver here
                      </Button>
                    )}
                    <Button variant="outline" to={`/addresses/${address.id}`} onClick={onDone}>Edit</Button>
                    {confirmId === address.id ? (
                      <Button variant="danger" disabled={pendingId === address.id} onClick={() => remove(address)}>
                        Confirm delete
                      </Button>
                    ) : (
                      <button type="button" className="text-button" onClick={() => setConfirmId(address.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div className="address-card__actions">
        <Button to="/addresses/new" state={{ from: `${place.pathname}${place.search}` }} onClick={onDone}>Add address</Button>
        {deliverySelect ? (
          <Button type="button" variant="outline" onClick={openLocationSheet}>GPS / PIN / area</Button>
        ) : null}
        {picker ? <Button variant="ghost" to="/addresses" onClick={onDone}>Manage addresses</Button> : null}
      </div>
    </div>
  )
}
