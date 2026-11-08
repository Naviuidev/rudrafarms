import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { OrdersError, fetchAdminOrder, updateAdminOrderStatus } from '../api/ordersApi.js'
import { fetchDeliveries, saveAssignment } from '../api/deliveriesApi.js'
import { orderSection } from '../orders/sections.js'

function formatInr(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0)
}

function labelize(value) {
  const text = String(value || '').replace(/_/g, ' ').trim()
  if (!text) return '—'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatDay(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function SpecTable({ rows }) {
  const visible = rows.filter((row) => row && row.value !== '' && row.value != null)
  if (!visible.length) return <p className="muted">—</p>
  return (
    <div className="table-scroll">
      <table className="data-table spec-table">
        <tbody>
          {visible.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td className={row.emphasis ? 'spec-table__money' : undefined}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrderAccordion({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="panel order-accordion">
      <button type="button" className="order-accordion__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <h2>{title}</h2>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="order-accordion__panel">{children}</div> : null}
    </section>
  )
}

const dayTones = [
  { tone: 'delivered', label: 'Delivered' },
  { tone: 'upcoming', label: 'Upcoming' },
  { tone: 'skipped', label: 'Skipped' },
  { tone: 'paused', label: 'Paused' },
  { tone: 'pending', label: 'Yet to be delivered' },
]

function weekdayLabel(value) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date)
}

function istToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function defaultDeliveryDate(order) {
  const start = order?.subscriptionCycle?.periodStart || ''
  const end = order?.subscriptionCycle?.periodEnd || ''
  const today = istToday()
  if (start && end && today >= start && today <= end) return today
  if (start) return start
  return order?.slotDate ? String(order.slotDate).slice(0, 10) : today
}

function DeliveryDays({ days }) {
  return (
    <section className="panel">
      <h2>Delivery days</h2>
      <ul className="day-legend">
        {dayTones.map((item) => (
          <li key={item.tone} className={`day-card day-card--${item.tone}`}>{item.label}</li>
        ))}
      </ul>
      {(days || []).length === 0 ? <p className="muted">No delivery days on this order.</p> : (
        <ul className="day-grid">
          {days.map((day) => (
            <li key={day.date} className={`day-card day-card--${day.tone}`}>
              <span className="day-card__when">{weekdayLabel(day.date)}</span>
              <span className="day-card__date">{formatDay(day.date)}</span>
              <span className="day-card__label">{day.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const floorStatuses = ['confirmed', 'preparing', 'assigned', 'out_for_delivery', 'delivered', 'cancelled', 'failed']

function statusChoices(current) {
  if (current === 'pending_payment') return ['pending_payment', 'cancelled', 'failed']
  return floorStatuses.includes(current) ? floorStatuses : [current, ...floorStatuses]
}

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const [params] = useSearchParams()
  const section = orderSection(params.get('section'))
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [personnel, setPersonnel] = useState([])
  const [personId, setPersonId] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (!orderId) return undefined
    let cancel = false
    setError('')
    fetchAdminOrder(orderId)
      .then((data) => {
        if (cancel) return
        const order = data?.order || null
        setDetail(order)
        setStatus(order?.status || '')
        setPersonId(order?.assignment?.personnelId || '')
        setDeliveryDate((current) => current || defaultDeliveryDate(order))
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof OrdersError ? e.message : 'Could not load order.')
      })
    return () => {
      cancel = true
    }
  }, [orderId])

  useEffect(() => {
    let cancel = false
    fetchDeliveries()
      .then((data) => {
        if (!cancel) setPersonnel(data.personnel.filter((person) => person.active))
      })
      .catch(() => {
        if (!cancel) setPersonnel([])
      })
    return () => {
      cancel = true
    }
  }, [])

  const o = detail

  async function saveStatus(event) {
    event.preventDefault()
    if (!o) return
    setBusy(true)
    setSaved('')
    setError('')
    try {
      const next = await updateAdminOrderStatus(o.id, status, note, o.deliveryType === 'subscription' ? deliveryDate : '')
      setDetail(next)
      setStatus(next?.status || status)
      setPersonId(next?.assignment?.personnelId || '')
      setNote('')
      setSaved(o.deliveryType === 'subscription'
        ? `${formatDay(deliveryDate)} is now ${labelize(status)} on Delivery days.`
        : 'Order updated.')
    } catch (e) {
      setError(e instanceof OrdersError ? e.message : 'Could not update the order.')
    } finally {
      setBusy(false)
    }
  }

  async function assignPerson(event) {
    event.preventDefault()
    if (!o || o.deliveryType === 'subscription') return
    setBusy(true)
    setSaved('')
    setError('')
    try {
      await saveAssignment({
        id: o.assignment?.id || '',
        orderId: o.id,
        personnelId: personId,
        status: o.assignment?.status && o.assignment.status !== 'pending_assignment' ? o.assignment.status : 'assigned',
        notes: note,
      })
      const data = await fetchAdminOrder(o.id)
      const next = data?.order || null
      setDetail(next)
      setStatus(next?.status || status)
      setSaved(personId ? 'Delivery person assigned.' : 'Assignment saved without a person.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign this order.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DocumentTitle title={o ? `Order ${o.orderNumber}` : 'Order'} />
      <div className="page-heading">
        <p className="eyebrow">Orders</p>
        <h1>{o ? o.orderNumber : 'Order'}</h1>
        <p><Link to="/orders">← All orders</Link></p>
      </div>

      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">{saved}</p> : null}
      {!o && !error ? <p role="status">Loading…</p> : null}

      {o && section === 'details' ? (
        <div className="order-sheet">
        <OrderAccordion title="Order">
          <SpecTable
            rows={[
              { label: 'Status', value: labelize(o.status) },
              o.paymentStatus ? { label: 'Payment', value: labelize(o.paymentStatus) } : null,
              o.fulfillmentStatus ? { label: 'Fulfillment', value: labelize(o.fulfillmentStatus) } : null,
              { label: 'Type', value: labelize(o.deliveryType) },
              { label: 'Slot', value: `${o.slotLabel || o.slotKey || '—'}${o.slotDate ? ` · ${formatDay(o.slotDate)}` : ''}` },
              { label: 'Subtotal', value: formatInr(o.subtotal) },
              { label: 'Discount', value: formatInr(o.discount) },
              { label: 'Tax', value: formatInr(o.tax) },
              { label: 'Delivery', value: formatInr(o.deliveryFee) },
              { label: 'Payable', value: formatInr(o.payable), emphasis: true },
              o.cancellationRequested ? { label: 'Cancellation', value: 'Customer asked to cancel' } : null,
              o.cancellationReason ? { label: 'Reason', value: o.cancellationReason } : null,
              o.refundStatus ? { label: 'Refund', value: `${labelize(o.refundStatus)}. Finish a paid refund in Razorpay.` } : null,
              { label: 'Order ID', value: o.id },
              o.razorpayOrderId ? { label: 'Razorpay order', value: o.razorpayOrderId } : null,
              o.razorpayPaymentId ? { label: 'Razorpay payment', value: o.razorpayPaymentId } : null,
            ]}
          />
        </OrderAccordion>
        <DeliveryDays days={o.deliveryDays} />
        </div>
      ) : null}

      {o && section === 'status' ? (
        <section className="panel">
          <h2>Update status</h2>
          <form className="admin-form order-form" onSubmit={saveStatus}>
            <TextField
              id="delivery-date"
              label="Delivery date"
              type="date"
              required={o.deliveryType === 'subscription'}
              min={o.subscriptionCycle?.periodStart || undefined}
              max={o.subscriptionCycle?.periodEnd || undefined}
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
            />
            <label className="field">
              <span className="field__label">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statusChoices(o.status).map((value) => (
                  <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <TextField label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
            <Button type="submit" disabled={busy || (o.deliveryType === 'subscription' && !deliveryDate)}>{busy ? 'Saving…' : 'Update status'}</Button>
          </form>
          {o.deliveryType === 'subscription' ? <p className="muted">The date you choose updates that card on Delivery days.</p> : null}
          {o.status === 'pending_payment' ? <p className="muted">Payment is still open. Cancel it here, or wait until Razorpay marks it paid.</p> : null}
          {o.deliveryType === 'subscription' || ['cancelled', 'failed'].includes(o.status) ? null : (
            <p className="muted">Cancelling a paid order returns the items to stock and marks the refund as pending.</p>
          )}
          <DeliveryDays days={o.deliveryDays} />
        </section>
      ) : null}

      {o && section === 'assign' ? (
        <section className="panel">
          <h2>Assign delivery</h2>
          {o.deliveryType === 'subscription' ? (
            <>
              <p className="muted">Daily drops for this plan are assigned from Deliveries. This order stays the billing record.</p>
              <p><Button to="/deliveries?section=upcoming" variant="outline">Upcoming deliveries</Button></p>
            </>
          ) : (
            <form className="admin-form order-form" onSubmit={assignPerson}>
              <label className="field">
                <span className="field__label">Delivery person</span>
                <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {personnel.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
              <TextField label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
              <Button type="submit" disabled={busy}>{o.assignment ? 'Update assignment' : 'Assign delivery'}</Button>
              {o.assignment ? <p className="muted">Route: {o.assignment.status.replace(/_/g, ' ')}{o.assignment.personnelName ? ` · ${o.assignment.personnelName}` : ''}</p> : null}
            </form>
          )}
        </section>
      ) : null}

      {o && section === 'customer' ? (
        <section className="panel">
          <h2>Customer</h2>
          <SpecTable
            rows={[
              { label: 'Name', value: <Link to={`/customers/${o.customerId}`}>{o.customerName}</Link> },
              { label: 'Email', value: o.customerEmail || '—' },
              { label: 'Phone', value: o.customerPhone || o.address?.contactPhone || '—' },
              { label: 'Customer ID', value: o.customerId },
            ]}
          />
        </section>
      ) : null}

      {o && section === 'address' ? (
        <section className="panel">
          <h2>Delivery address</h2>
          {o.address && typeof o.address === 'object' ? (
            <SpecTable
              rows={[
                { label: 'Line 1', value: o.address.line1 || '—' },
                o.address.line2 ? { label: 'Line 2', value: o.address.line2 } : null,
                { label: 'City', value: o.address.city || '—' },
                { label: 'State', value: o.address.state || '—' },
                { label: 'PIN', value: o.address.pin || '—' },
                { label: 'Phone', value: o.address.contactPhone || '—' },
                o.deliveryNote ? { label: 'Note', value: o.deliveryNote } : null,
              ]}
            />
          ) : <p className="muted">—</p>}
        </section>
      ) : null}

      {o && section === 'subscription' ? (
        <section className="panel">
          <h2>Subscription</h2>
          {o.subscription && o.deliveryType === 'subscription' ? (
            <SpecTable
              rows={[
                { label: 'Plan status', value: labelize(o.subscription.status) },
                { label: 'Schedule', value: labelize(o.subscription.scheduleKey) },
                { label: 'Started', value: formatDay(o.subscription.startDate) },
                o.subscriptionCycle ? { label: 'Period', value: `${formatDay(o.subscriptionCycle.periodStart)} → ${formatDay(o.subscriptionCycle.periodEnd)}` } : null,
                o.subscriptionCycle ? { label: 'Billable days', value: String(o.subscriptionCycle.billableDeliveryDays ?? '—') } : null,
                o.subscriptionCycle ? { label: 'Cycle status', value: labelize(o.subscriptionCycle.status) } : null,
                o.subscriptionCycle ? { label: 'Cycle amount', value: formatInr(Math.round((o.subscriptionCycle.amountPaise || 0) / 100)), emphasis: true } : null,
                { label: 'Subscription ID', value: o.subscriptionId },
                o.subscriptionCycleId ? { label: 'Cycle ID', value: o.subscriptionCycleId } : null,
              ]}
            />
          ) : <p className="muted">This order is a one-time delivery.</p>}
        </section>
      ) : null}

      {o && section === 'items' ? (
        <section className="panel">
          <h2>Line items</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Product</th><th>Unit</th><th>Qty</th><th>Price</th><th>Line</th><th>Tax</th></tr>
              </thead>
              <tbody>
                {(o.items || []).map((line) => (
                  <tr key={`${line.productId}-${line.variantId}`}>
                    <td>{line.name}</td>
                    <td>{line.unit}</td>
                    <td>{line.qty}</td>
                    <td>{formatInr(line.price)}</td>
                    <td>{formatInr(line.lineTotal)}</td>
                    <td>{formatInr(line.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  )
}
