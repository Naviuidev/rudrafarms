import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deliverySection } from '../deliveries/sections.js'
import DeliverySlotsPanel from './DeliverySlotsPanel.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import {
  DeliveriesError,
  fetchAssignmentHistory,
  fetchDeliveries,
  fetchPendingDeliveries,
  fetchUpcomingDeliveries,
  saveAssignment,
  savePersonnel,
} from '../api/deliveriesApi.js'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'
import { fetchAdminCustomers } from '../api/customersApi.js'
import { fetchAdminOrder, fetchAdminOrders, OrdersError, updateAdminOrderStatus } from '../api/ordersApi.js'

function formatInr(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0)
}

const dayStatuses = ['confirmed', 'preparing', 'assigned', 'out_for_delivery', 'delivered', 'cancelled', 'failed']

const statuses = [
  'pending_assignment',
  'assigned',
  'processing',
  'out_for_delivery',
  'delivered',
  'failed',
  'rescheduled',
  'cancelled',
]

const emptyPerson = { id: '', name: '', phone: '', address: '', vehicle: '', active: true }

export default function DeliveriesPage() {
  const [personnel, setPersonnel] = useState([])
  const [assignments, setAssignments] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', personnelId: '', status: '' })
  const [personForm, setPersonForm] = useState(emptyPerson)
  const [assignForm, setAssignForm] = useState({
    id: '',
    orderId: '',
    subscriptionDeliveryId: '',
    personnelId: '',
    status: 'pending_assignment',
    notes: '',
  })
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [customerOrders, setCustomerOrders] = useState([])
  const [syncOrderId, setSyncOrderId] = useState('')
  const [syncOrder, setSyncOrder] = useState(null)
  const [syncDate, setSyncDate] = useState('')
  const [syncStatus, setSyncStatus] = useState('delivered')
  const [syncNote, setSyncNote] = useState('')
  const [syncSaved, setSyncSaved] = useState('')
  const [history, setHistory] = useState([])
  const [historyFor, setHistoryFor] = useState('')
  const [pendingOrders, setPendingOrders] = useState([])
  const [pendingSubs, setPendingSubs] = useState([])
  const [upcoming, setUpcoming] = useState({ date: '', label: '', deliveries: [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [params, setParams] = useSearchParams()
  const section = deliverySection(params.get('section'))
  const reportError = useCallback((message) => setError(message), [])

  function showSection(id) {
    setParams({ section: id })
  }

  const load = useCallback(() => {
    setError('')
    return Promise.all([
      fetchDeliveries(filters),
      fetchPendingDeliveries({
        from: filters.from,
        to: filters.to,
        limit: 120,
      }),
      fetchUpcomingDeliveries(),
    ])
      .then(([data, pending, nextDay]) => {
        setPersonnel(data.personnel)
        setAssignments(data.assignments)
        setPendingOrders(pending.pendingOrders)
        setPendingSubs(pending.pendingSubscriptionDeliveries)
        setUpcoming(nextDay)
      })
      .catch((e) => setError(e instanceof DeliveriesError ? e.message : 'Could not load deliveries.'))
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(load, 15000)

  useEffect(() => {
    if (section !== 'status') return undefined
    let cancel = false
    fetchAdminCustomers({ limit: 200 })
      .then((rows) => {
        if (!cancel) setCustomers(rows)
      })
      .catch(() => {
        if (!cancel) setCustomers([])
      })
    return () => {
      cancel = true
    }
  }, [section])

  useEffect(() => {
    if (!customerId) {
      setCustomerOrders([])
      setSyncOrderId('')
      setSyncOrder(null)
      return undefined
    }
    let cancel = false
    fetchAdminOrders({ customerId, limit: 50 })
      .then((rows) => {
        if (cancel) return
        setCustomerOrders(rows)
        setSyncOrderId(rows[0]?.id || '')
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof OrdersError ? e.message : 'Could not load this customer’s orders.')
      })
    return () => {
      cancel = true
    }
  }, [customerId])

  useEffect(() => {
    if (!syncOrderId) {
      setSyncOrder(null)
      return undefined
    }
    let cancel = false
    fetchAdminOrder(syncOrderId)
      .then((data) => {
        if (cancel) return
        const order = data?.order || null
        setSyncOrder(order)
        setSyncDate(defaultDay(order))
      })
      .catch((e) => {
        if (!cancel) setError(e instanceof OrdersError ? e.message : 'Could not load the order.')
      })
    return () => {
      cancel = true
    }
  }, [syncOrderId])

  const customerKinds = useMemo(() => ({
    hasSubscription: customerOrders.some((row) => row.deliveryType === 'subscription'),
    hasDelivery: customerOrders.some((row) => row.deliveryType !== 'subscription'),
  }), [customerOrders])

  const personOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...personnel.map((p) => ({ value: p.id, label: p.name }))],
    [personnel],
  )

  async function submitPerson(event) {
    event.preventDefault()
    setBusy(true)
    try {
      setPersonnel(await savePersonnel(personForm))
      setPersonForm(emptyPerson)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitAssignment(event) {
    event.preventDefault()
    setBusy(true)
    try {
      setAssignments(
        await saveAssignment({
          id: assignForm.id || undefined,
          orderId: assignForm.orderId.trim(),
          subscriptionDeliveryId: assignForm.subscriptionDeliveryId.trim(),
          personnelId: assignForm.personnelId,
          status: assignForm.status,
          notes: assignForm.notes.trim(),
        }),
      )
      setAssignForm((f) => ({ ...f, id: '', orderId: '', subscriptionDeliveryId: '', notes: '' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitCustomerStatus(event) {
    event.preventDefault()
    if (!syncOrderId || !syncDate) {
      setError('Choose a customer, an order, and a date.')
      return
    }
    setBusy(true)
    setError('')
    setSyncSaved('')
    try {
      const next = await updateAdminOrderStatus(syncOrderId, syncStatus, syncNote.trim(), syncDate)
      setSyncOrder(next)
      setSyncNote('')
      setSyncSaved(`${formatDay(syncDate)} is now ${syncStatus.replace(/_/g, ' ')} on ${next?.orderNumber || 'the order'}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the delivery day.')
    } finally {
      setBusy(false)
    }
  }

  function pickPendingOrder(row) {
    setAssignForm((f) => ({
      ...f,
      orderId: row.orderId,
      subscriptionDeliveryId: '',
      status: f.status || 'pending_assignment',
    }))
    showSection('assignment')
  }

  function pickPendingSubscription(row) {
    setAssignForm((f) => ({
      ...f,
      subscriptionDeliveryId: row.subscriptionDeliveryId,
      orderId: '',
      status: f.status || 'pending_assignment',
    }))
    showSection('assignment')
  }

  async function loadHistory(id) {
    setHistoryFor(id)
    setHistory([])
    try {
      setHistory(await fetchAssignmentHistory(id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <DocumentTitle title="Deliveries" />
      <div className="page-heading">
        <p className="eyebrow">Operations</p>
        <h1>Deliveries</h1>
        <p>{sectionCopy[section]}</p>
      </div>

      {error ? <p className="field__error" role="alert">{error}</p> : null}

      {section === 'slots' ? <DeliverySlotsPanel onError={reportError} /> : null}

      {section === 'assignments' ? (
      <div className="admin-grid">
        <section className="panel">
          <h2>Filters</h2>
          <div className="admin-form admin-form--inline" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <TextField label="From" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            <TextField label="To" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            <label className="field">
              <span className="field__label">Personnel</span>
              <select value={filters.personnelId} onChange={(e) => setFilters((f) => ({ ...f, personnelId: e.target.value }))}>
                <option value="">All</option>
                {personnel.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Status</span>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="">All</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={() => load()} disabled={busy}>Refresh</Button>
          </div>
        </section>
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>All deliveries</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Updated</th>
                  <th>Order / sub delivery</th>
                  <th>Type</th>
                  <th>Person</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={7}>No assignments yet.</td>
                  </tr>
                ) : null}
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{a.updatedAt}</td>
                    <td>
                      {a.orderNumber ? <strong>{a.orderNumber}</strong> : null}
                      {a.orderId ? <div className="muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{a.orderId}</div> : null}
                      {a.subscriptionDeliveryDate ? <div>Sub {a.subscriptionDeliveryDate}</div> : null}
                      {a.subscriptionDeliveryId ? <div className="muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{a.subscriptionDeliveryId}</div> : null}
                    </td>
                    <td>{a.deliveryType || '—'}</td>
                    <td>{a.personnelName || '—'}</td>
                    <td>{a.status.replace(/_/g, ' ')}</td>
                    <td style={{ maxWidth: '200px', fontSize: '13px' }}>{a.notes || '—'}</td>
                    <td>
                      <button type="button" className="link-button" onClick={() => {
                        setStatusForm((f) => ({ ...f, assignmentId: a.id }))
                        loadHistory(a.id)
                        showSection('status')
                      }}
                      >Update status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      ) : null}

      {section === 'upcoming' ? (
      <section className="panel">
        <h2>Upcoming deliveries</h2>
        <p className="muted">Subscription drops for {upcoming.label || 'tomorrow'}. Skipped days are left off this list.</p>
        {upcoming.deliveries.length === 0 ? (
          <p className="muted">No subscription deliveries tomorrow.</p>
        ) : (
          <ul className="upcoming-list">
            {upcoming.deliveries.map((drop) => (
              <li key={drop.subscriptionDeliveryId} className="upcoming-card">
                <div>
                  <strong>{drop.customerName}</strong>
                  <p className="muted">{drop.planName} · {scheduleLabel(drop.scheduleKey)}</p>
                  <p>{drop.address || 'No address saved'}</p>
                  {drop.customerPhone ? <p className="muted">{drop.customerPhone}</p> : null}
                </div>
                <ul>
                  {drop.items.map((item) => (
                    <li key={`${item.name}-${item.unit}`}>{item.name}{item.unit ? ` · ${item.unit}` : ''} × {item.dailyQty}</li>
                  ))}
                </ul>
                <div className="upcoming-card__actions">
                  <span className="muted">{drop.personnelName ? `With ${drop.personnelName}` : 'No driver yet'}</span>
                  <button type="button" className="link-button" onClick={() => pickPendingSubscription(drop)}>Assign this</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}

      {section === 'personnel' ? (
      <div className="admin-grid">
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>Delivery team</h2>
          <form className="admin-form" onSubmit={submitPerson}>
            <TextField label="Name" value={personForm.name} onChange={(e) => setPersonForm((f) => ({ ...f, name: e.target.value }))} required />
            <TextField label="Phone" value={personForm.phone} onChange={(e) => setPersonForm((f) => ({ ...f, phone: e.target.value }))} />
            <TextField label="Address" value={personForm.address} onChange={(e) => setPersonForm((f) => ({ ...f, address: e.target.value }))} />
            <TextField label="Vehicle" value={personForm.vehicle} onChange={(e) => setPersonForm((f) => ({ ...f, vehicle: e.target.value }))} />
            <label className="field field--inline">
              <input type="checkbox" checked={personForm.active} onChange={(e) => setPersonForm((f) => ({ ...f, active: e.target.checked }))} />
              <span>Active</span>
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save team member'}</Button>
              {personForm.id ? (
                <Button type="button" variant="outline" onClick={() => setPersonForm(emptyPerson)}>Add another</Button>
              ) : null}
            </div>
          </form>
          <div className="table-scroll" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Active</th><th /></tr>
              </thead>
              <tbody>
                {personnel.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={4}>No delivery personnel yet.</td>
                  </tr>
                ) : null}
                {personnel.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.phone}</td>
                    <td>{p.active ? 'Yes' : 'No'}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setPersonForm({
                          id: p.id,
                          name: p.name || '',
                          phone: p.phone || '',
                          address: p.address || '',
                          vehicle: p.vehicle || '',
                          active: Boolean(p.active),
                        })}
                      >Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      ) : null}

      {section === 'pending' ? (
      <div className="admin-grid">
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>Needs a driver</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Quick orders: paid, not yet linked to a delivery assignment. Subscription rows: scheduled day with no assignment.
            Date filters use slot date (orders) or delivery date (subscriptions).
          </p>
          <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem' }}>Quick orders</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Order</th><th>Customer</th><th>Slot</th><th>Amount</th><th /></tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((r) => (
                      <tr key={r.orderId}>
                        <td>
                          <Link to={`/orders/${r.orderId}`}><strong>{r.orderNumber}</strong></Link>
                          <div className="muted" style={{ fontSize: '10px', wordBreak: 'break-all' }}>{r.orderId}</div>
                        </td>
                        <td>
                          <div>{r.customerName}</div>
                          <div className="muted" style={{ fontSize: '12px' }}>{r.customerEmail}</div>
                        </td>
                        <td style={{ fontSize: '12px' }}>{r.slotLabel || r.slotKey}{r.slotDate ? ` · ${r.slotDate}` : ''}</td>
                        <td>{formatInr(r.payable)}</td>
                        <td><button type="button" className="link-button" onClick={() => pickPendingOrder(r)}>Assign this</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingOrders.length === 0 ? <p className="muted">None right now.</p> : null}
            </div>
            <div>
              <h3 style={{ fontSize: '1rem' }}>Subscription deliveries</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>Schedule</th><th>IDs</th><th /></tr>
                  </thead>
                  <tbody>
                    {pendingSubs.map((r) => (
                      <tr key={r.subscriptionDeliveryId}>
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{r.deliveryDate}</strong></td>
                        <td>
                          <div>{r.customerName}</div>
                          <div className="muted" style={{ fontSize: '12px' }}>{r.customerEmail}</div>
                        </td>
                        <td>{r.scheduleKey}</td>
                        <td style={{ fontSize: '10px', wordBreak: 'break-all' }}>
                          sub {r.subscriptionId.slice(0, 8)}…
                          <div>del {r.subscriptionDeliveryId}</div>
                        </td>
                        <td><button type="button" className="link-button" onClick={() => pickPendingSubscription(r)}>Assign this</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingSubs.length === 0 ? <p className="muted">None in this range.</p> : null}
            </div>
          </div>
        </section>
      </div>
      ) : null}

      {section === 'assignment' ? (
      <div className="admin-grid">
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <h2>Assign a delivery</h2>
          <p className="muted" style={{ marginTop: 0 }}>Link either an order UUID or a subscription delivery UUID. Leave the other blank.</p>
          <form className="admin-form" onSubmit={submitAssignment}>
            <TextField label="Assignment ID (optional, for update)" value={assignForm.id} onChange={(e) => setAssignForm((f) => ({ ...f, id: e.target.value }))} />
            <TextField label="Order ID" value={assignForm.orderId} onChange={(e) => setAssignForm((f) => ({ ...f, orderId: e.target.value }))} />
            <TextField label="Subscription delivery ID" value={assignForm.subscriptionDeliveryId} onChange={(e) => setAssignForm((f) => ({ ...f, subscriptionDeliveryId: e.target.value }))} />
            <label className="field">
              <span className="field__label">Personnel</span>
              <select value={assignForm.personnelId} onChange={(e) => setAssignForm((f) => ({ ...f, personnelId: e.target.value }))}>
                {personOptions.map((o) => (
                  <option key={`${o.label}-${o.value}`} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Status</span>
              <select value={assignForm.status} onChange={(e) => setAssignForm((f) => ({ ...f, status: e.target.value }))}>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <TextField label="Notes" value={assignForm.notes} onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))} />
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save delivery'}</Button>
          </form>
        </section>
      </div>
      ) : null}

      {section === 'status' ? (
      <div className="order-sheet">
        <section className="panel">
          <h2>Update status</h2>
          <form className="admin-form" onSubmit={submitCustomerStatus}>
            <label className="field">
              <span className="field__label">Customer</span>
              <span className="customer-pick">
                <select value={customerId} onChange={(event) => { setSyncSaved(''); setCustomerId(event.target.value) }}>
                  <option value="">Choose a customer</option>
                  {customers.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}{person.phone ? ` · ${person.phone}` : ''}</option>
                  ))}
                </select>
                {customerKinds.hasSubscription ? <span className="kind-badge kind-badge--subscription">Subscription</span> : null}
                {customerKinds.hasDelivery ? <span className="kind-badge kind-badge--delivery">Delivery</span> : null}
              </span>
            </label>
            <label className="field">
              <span className="field__label">Order</span>
              <select value={syncOrderId} onChange={(event) => { setSyncSaved(''); setSyncOrderId(event.target.value) }} disabled={!customerId}>
                <option value="">{customerId ? 'Choose an order' : 'Choose a customer first'}</option>
                {customerOrders.map((row) => (
                  <option key={row.id} value={row.id}>{row.orderNumber} · {row.deliveryType}</option>
                ))}
              </select>
            </label>
            <TextField
              id="sync-date"
              label="Delivery date"
              type="date"
              required
              min={syncOrder?.subscriptionCycle?.periodStart || undefined}
              max={syncOrder?.subscriptionCycle?.periodEnd || undefined}
              value={syncDate}
              onChange={(event) => setSyncDate(event.target.value)}
            />
            <label className="field">
              <span className="field__label">Status</span>
              <select value={syncStatus} onChange={(event) => setSyncStatus(event.target.value)}>
                {dayStatuses.map((value) => (
                  <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
            <TextField label="Note" value={syncNote} onChange={(event) => setSyncNote(event.target.value)} />
            <Button type="submit" disabled={busy || !customerId || !syncOrderId || !syncDate}>{busy ? 'Saving…' : 'Update delivery day'}</Button>
          </form>
          {syncSaved ? <p className="muted" role="status">{syncSaved}</p> : null}
          <p className="muted">This writes the same day on the customer’s order, so Delivery days stays in sync.</p>
        </section>
        {syncOrder ? (
          <section className="panel">
            <h2>Delivery days · {syncOrder.orderNumber}</h2>
            {(syncOrder.deliveryDays || []).length === 0 ? <p className="muted">No delivery days on this order.</p> : (
              <ul className="day-grid">
                {syncOrder.deliveryDays.map((day) => (
                  <li key={day.date} className={`day-card day-card--${day.tone}`}>
                    <span className="day-card__date">{formatDay(day.date)}</span>
                    <span className="day-card__label">{day.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
      ) : null}
    </>
  )
}

function defaultDay(order) {
  const start = order?.subscriptionCycle?.periodStart || ''
  const end = order?.subscriptionCycle?.periodEnd || ''
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (start && end && today >= start && today <= end) return today
  if (start) return start
  return order?.slotDate ? String(order.slotDate).slice(0, 10) : today
}

function formatDay(value) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value || ''
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function scheduleLabel(key) {
  if (key === 'morning') return 'Morning · before 7:00 AM'
  if (key === 'evening') return 'Evening · before 4:00 PM'
  if (key === 'both') return 'Morning and evening'
  return key || 'Daily drop'
}

const sectionCopy = {
  assignments: 'Every delivery already given to the team. Filter by date, person, or status.',
  upcoming: 'Tomorrow’s subscription drops, ready to pack and assign.',
  personnel: 'People who carry orders. There is no separate rider login.',
  pending: 'Paid orders and subscription days that still need a driver.',
  assignment: 'Give an order or a subscription day to someone on the team.',
  status: 'Choose a customer and a date. The matching order day updates with that status.',
  slots: 'Time windows shoppers can choose at checkout.',
}
