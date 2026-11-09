import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import {
  SubscriptionApiError,
  pauseSubscription,
  resumeSubscription,
  sendPauseQuery,
  skipSubscriptionDelivery,
  withdrawSkippedDelivery,
} from '../api/subscriptionApi.js'
import { formatPrice } from '../data/catalog.js'

export const DELIVERY_CLOCK = {
  morning: { label: '7:00 AM', minutes: 7 * 60 },
  evening: { label: '4:00 PM', minutes: 16 * 60 },
  both: { label: '7:00 AM', minutes: 7 * 60 },
}

export function scheduleLabel(key) {
  if (key === 'morning') return 'Morning · before 7:00 AM'
  if (key === 'evening') return 'Evening · before 4:00 PM'
  if (key === 'both') return 'Morning and evening'
  return key || 'Daily drop'
}

export function prettyDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return value || ''
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function plainStatus(status) {
  return String(status || '').replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase())
}

function canWithdrawSkip(date, scheduleKey) {
  const clock = DELIVERY_CLOCK[scheduleKey] || DELIVERY_CLOCK.morning
  const [year, month, day] = String(date || '').split('-').map(Number)
  if (!year || !month || !day) return false
  const hours = String(Math.floor(clock.minutes / 60)).padStart(2, '0')
  const mins = String(clock.minutes % 60).padStart(2, '0')
  const delivery = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hours}:${mins}:00+05:30`)
  return Date.now() < delivery.getTime() - 3 * 60 * 60 * 1000
}

function todayIso() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export default function SubscriptionManagePanel({ sub, onSubChange, error: externalError, onError, showBackLink = false }) {
  const [busy, setBusy] = useState(false)
  const [pauseStart, setPauseStart] = useState(todayIso())
  const [pauseEnd, setPauseEnd] = useState(todayIso())
  const [skipDate, setSkipDate] = useState(todayIso())
  const [notice, setNotice] = useState(null)
  const [queryOpen, setQueryOpen] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [querySent, setQuerySent] = useState(false)
  const [error, setError] = useState('')

  const displayError = externalError || error

  async function runAction(work, success) {
    setBusy(true)
    setError('')
    if (onError) onError('')
    try {
      const next = await work()
      if (next) onSubChange(next)
      if (success) setNotice(success)
    } catch (reason) {
      const message = reason instanceof SubscriptionApiError ? reason.message : 'That change did not save.'
      setError(message)
      if (onError) onError(message)
    } finally {
      setBusy(false)
    }
  }

  function openQuery() {
    const ranges = [...new Set((sub?.pauses || []).map((pause) => `${prettyDate(pause.start)} to ${prettyDate(pause.end)}`))]
    const when = ranges.length ? ranges.join(', ') : 'the paused dates'
    setQueryText(`My subscription is paused from ${when}. Please check these dates and tell me if deliveries can start again.`)
    setQuerySent(false)
    setQueryOpen(true)
  }

  async function submitQuery() {
    if (!sub) return
    setBusy(true)
    setError('')
    try {
      await sendPauseQuery({ subscriptionId: sub.id, message: queryText.trim() })
      setQuerySent(true)
    } catch (reason) {
      const message = reason instanceof SubscriptionApiError ? reason.message : 'The query could not be sent.'
      setError(message)
      if (onError) onError(message)
      setQueryOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const upcoming = (sub.upcomingDeliveries || []).slice(0, 7)
  const past = (sub.pastDeliveries || []).slice(0, 7)
  const clock = DELIVERY_CLOCK[sub.scheduleKey] || DELIVERY_CLOCK.morning
  const pauses = sub.pauses || []

  return (
    <>
      {displayError ? <p className="order-track__alert" role="alert">{displayError}</p> : null}

      <div className="subs-detail subs-detail--inline">
        <section className="subs-basket">
          <h2>Daily basket</h2>
          <ul className="subs-list">
            {(sub.lines || []).map((line) => (
              <li key={`${line.productId}:${line.variantId}`} className="subs-row subs-row--line">
                <span className="subs-row__meta">
                  <span className="subs-row__name">{line.name}</span>
                  <span className="subs-row__unit">{line.unit || 'Each delivery'}</span>
                </span>
                <strong>{line.dailyQty} / day</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="subs-basket">
          <h2>Billing</h2>
          <ul className="subs-list">
            {(sub.cycles || []).map((cycle) => (
              <li key={cycle.id} className="subs-row subs-row--manage">
                <span className="subs-row__meta">
                  <span className="subs-row__name">{prettyDate(cycle.periodStart)} – {prettyDate(cycle.periodEnd)}</span>
                  <span className="subs-row__unit">
                    {cycle.statusLabel} · {cycle.billableDeliveryDays} days · {formatPrice(Math.round(cycle.amountPaise / 100))}
                  </span>
                </span>
                {cycle.orderId ? <Button variant="outline" to={`/orders/${cycle.orderId}`}>Receipt</Button> : null}
              </li>
            ))}
          </ul>
        </section>

        <Accordion title="Deliveries">
          <p className="subs-label">Upcoming</p>
          {upcoming.length === 0 ? <p className="subs-muted">No drops scheduled yet.</p> : (
            <ul className="subs-list">
              {upcoming.map((drop) => (
                <li key={drop.date} className="subs-row subs-row--line">
                  <span className="subs-row__name">{prettyDate(drop.date)}</span>
                  <span className="subs-row__unit">{plainStatus(drop.status)}</span>
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 ? (
            <>
              <p className="subs-label subs-label--gap">Past</p>
              <ul className="subs-list">
                {past.map((drop) => (
                  <li key={drop.date} className="subs-row subs-row--line">
                    <span className="subs-row__name">{prettyDate(drop.date)}</span>
                    <span className="subs-row__unit">{plainStatus(drop.status)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Accordion>

        <Accordion title="Skipped days">
          <p className="subs-muted">Withdraw a skip until 3 hours before the {clock.label} delivery.</p>
          {(sub.skips || []).length === 0 ? <p className="subs-muted">No skipped days.</p> : (
            <ul className="subs-list">
              {sub.skips.map((date) => {
                const open = canWithdrawSkip(date, sub.scheduleKey)
                return (
                  <li key={date} className="subs-row subs-row--line">
                    <span className="subs-row__name">{prettyDate(date)}</span>
                    {open ? (
                      <button
                        type="button"
                        className="subs-withdraw"
                        disabled={busy}
                        onClick={() => runAction(
                          () => withdrawSkippedDelivery({ subscriptionId: sub.id, deliveryDate: date }),
                          { title: 'Skip withdrawn', message: `${prettyDate(date)} is back on your delivery list.` },
                        )}
                      >
                        Withdraw
                      </button>
                    ) : (
                      <span className="subs-row__unit">Closed · inside 3 hours</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Accordion>

        <Accordion title="Paused dates">
          {pauses.length === 0 ? <p className="subs-muted">No paused dates.</p> : (
            <ul className="subs-list">
              {pauses.map((pause) => (
                <li key={`${pause.start}:${pause.end}`} className="subs-row subs-row--line">
                  <span className="subs-row__name">{prettyDate(pause.start)} – {prettyDate(pause.end)}</span>
                </li>
              ))}
            </ul>
          )}
          {pauses.length > 0 ? (
            <div className="subs-actions">
              <Button type="button" variant="outline" disabled={busy} onClick={openQuery}>Send query to Rudras Farm</Button>
            </div>
          ) : null}
        </Accordion>

        <Accordion title="Pause or skip">
          <div className="subs-fields subs-fields--pair">
            <TextField id={`pause-start-${sub.id}`} label="Pause from" type="date" value={pauseStart} onChange={(event) => setPauseStart(event.target.value)} />
            <TextField id={`pause-end-${sub.id}`} label="Pause to" type="date" value={pauseEnd} onChange={(event) => setPauseEnd(event.target.value)} />
          </div>
          <div className="subs-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => runAction(
                () => pauseSubscription({ subscriptionId: sub.id, startDate: pauseStart, endDate: pauseEnd }),
                { title: 'Deliveries paused', message: `Drops from ${prettyDate(pauseStart)} to ${prettyDate(pauseEnd)} are on hold.` },
              )}
            >
              Pause deliveries
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => runAction(
                () => resumeSubscription({ subscriptionId: sub.id }),
                { title: 'Deliveries resumed', message: 'This plan is active again. Dates you already paused stay on the list.' },
              )}
            >
              Resume
            </Button>
          </div>
          <div className="subs-fields">
            <TextField id={`skip-date-${sub.id}`} label="Skip one day" type="date" value={skipDate} onChange={(event) => setSkipDate(event.target.value)} />
          </div>
          <div className="subs-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => runAction(
                () => skipSubscriptionDelivery({ subscriptionId: sub.id, deliveryDate: skipDate }),
                { title: 'Day skipped', message: `${prettyDate(skipDate)} will not be delivered. Withdraw it from Skipped days until 3 hours before ${clock.label}.` },
              )}
            >
              Skip this day
            </Button>
          </div>
        </Accordion>

        {showBackLink ? <Link className="order-track__back" to="/subscriptions">All subscriptions</Link> : null}
      </div>

      <Dialog open={Boolean(notice)} title={notice?.title || 'Saved'} onClose={() => setNotice(null)}>
        <p className="cancel-reasons__lead">{notice?.message}</p>
        <div className="cancel-reasons__actions">
          <Button type="button" onClick={() => setNotice(null)}>OK</Button>
        </div>
      </Dialog>

      <Dialog open={queryOpen} title="Send query to Rudras Farm" onClose={() => { if (!busy) setQueryOpen(false) }}>
        {querySent ? (
          <p className="cancel-reasons__lead">Rudras Farm has your query about the paused dates. They will reply on your account email.</p>
        ) : (
          <>
            <p className="cancel-reasons__lead">Tell the farm what you need for these paused dates. They will reply on your account email.</p>
            <TextField id={`pause-query-${sub.id}`} label="Message" multiline value={queryText} onChange={(event) => setQueryText(event.target.value)} />
          </>
        )}
        <div className="cancel-reasons__actions">
          {querySent ? (
            <Button type="button" onClick={() => setQueryOpen(false)}>Close</Button>
          ) : (
            <>
              <Button type="button" disabled={busy || queryText.trim().length < 10} onClick={submitQuery}>{busy ? 'Sending…' : 'Send query'}</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setQueryOpen(false)}>Close</Button>
            </>
          )}
        </div>
      </Dialog>
    </>
  )
}

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="subs-basket subs-accordion">
      <button type="button" className="subs-accordion__toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <h2>{title}</h2>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="subs-accordion__panel">{children}</div> : null}
    </section>
  )
}
