import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import { useToast } from '@brand/toastContext.js'
import { useShop } from '../context/shopContext.js'
import ServiceabilityStatus from './ServiceabilityStatus.jsx'

const typeLabels = { home: 'Home', work: 'Work', other: 'Other' }

export default function AddressBook({ onDone, picker = false }) {
  const { addresses, setDefaultAddress, deleteAddress } = useShop()
  const place = useLocation()
  const showToast = useToast()
  const [pendingId, setPendingId] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [error, setError] = useState('')

  async function makeDefault(address) {
    setError('')
    setPendingId(address.id)
    try {
      await setDefaultAddress(address.id)
      showToast({ title: 'Default address updated', message: `${address.line1} is now the delivery address.` })
      onDone?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This address could not be checked.')
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
        message="Add an address before placing a quick order or starting a subscription."
        action={<Button to="/addresses/new" state={{ from: `${place.pathname}${place.search}` }} onClick={onDone}>Add address</Button>}
      />
    )
  }

  async function pickAddress(address) {
    if (address.isDefault) {
      onDone?.()
      return
    }
    await makeDefault(address)
  }

  return (
    <div className="address-book">
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      <ul className={`address-list${picker ? ' address-list--picker' : ''}`}>
        {addresses.map((address) => (
          <li key={address.id} className={address.isDefault ? 'address-card address-card--default' : 'address-card'}>
            {picker ? (
              <button
                type="button"
                className="address-picker"
                disabled={pendingId === address.id}
                onClick={() => pickAddress(address)}
              >
                <p className="eyebrow">{typeLabels[address.type] || 'Address'}{address.isDefault ? ' · Selected' : ''}</p>
                <h3>{address.line1}</h3>
                <p>
                  {[address.line2, address.landmark, address.city, address.state, address.pin].filter(Boolean).join(', ')}
                </p>
                <p>{address.contactName} · {address.contactPhone}</p>
                <ServiceabilityStatus service={address.serviceability} />
              </button>
            ) : (
              <>
                <p className="eyebrow">{typeLabels[address.type] || 'Address'}{address.isDefault ? ' · Default' : ''}</p>
                <h3>{address.line1}</h3>
                <p>
                  {[address.line2, address.landmark, address.city, address.state, address.pin].filter(Boolean).join(', ')}
                </p>
                <p>{address.contactName} · {address.contactPhone}</p>
                <ServiceabilityStatus service={address.serviceability} />
                <div className="address-card__actions">
                  {address.isDefault ? null : (
                    <Button variant="outline" disabled={pendingId === address.id} onClick={() => makeDefault(address)}>
                      Set default
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
        ))}
      </ul>
      <div className="address-card__actions">
        <Button to="/addresses/new" state={{ from: `${place.pathname}${place.search}` }} onClick={onDone}>Add address</Button>
        {picker ? <Button variant="ghost" to="/addresses" onClick={onDone}>Manage addresses</Button> : null}
      </div>
    </div>
  )
}
