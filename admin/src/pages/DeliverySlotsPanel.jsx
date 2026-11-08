import { useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import {
  deleteDeliverySlot,
  fetchDeliverySlotConfig,
  saveDeliverySlot,
  saveDeliverySlotSettings,
} from '../api/deliverySlotsApi.js'

const emptySlot = {
  id: '',
  label: '',
  start: '06:00',
  end: '08:00',
  capacity: '20',
  sameDay: true,
  scheduled: true,
  active: true,
}

const emptySettings = {
  expressEnabled: true,
  expressCutoff: '18:00',
  expressEta: '90',
  sameDayCutoff: '16:00',
  scheduledDays: '7',
}

export default function DeliverySlotsPanel({ onError }) {
  const [settings, setSettings] = useState(emptySettings)
  const [slots, setSlots] = useState([])
  const [form, setForm] = useState(emptySlot)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetchDeliverySlotConfig()
      .then((data) => {
        if (data.settings) setSettings(toSettings(data.settings))
        setSlots(data.slots)
      })
      .catch((error) => onError(error.message))
  }, [onError])

  function apply(data) {
    if (data.settings) setSettings(toSettings(data.settings))
    setSlots(data.slots)
  }

  async function submitSettings(event) {
    event.preventDefault()
    setBusy(true)
    setNote('')
    try {
      apply(await saveDeliverySlotSettings({
        expressEnabled: settings.expressEnabled,
        expressCutoff: settings.expressCutoff,
        expressEta: Number(settings.expressEta) || 0,
        sameDayCutoff: settings.sameDayCutoff,
        scheduledDays: Number(settings.scheduledDays) || 0,
      }))
      setNote('Checkout is using these window rules.')
    } catch (error) {
      onError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitSlot(event) {
    event.preventDefault()
    setBusy(true)
    setNote('')
    try {
      apply(await saveDeliverySlot({
        id: form.id,
        label: form.label.trim(),
        start: form.start,
        end: form.end,
        capacity: Number(form.capacity) || 0,
        sameDay: form.sameDay,
        scheduled: form.scheduled,
        active: form.active,
      }))
      setForm(emptySlot)
      setNote('Checkout now shows the saved delivery slots.')
    } catch (error) {
      onError(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    setBusy(true)
    setNote('')
    try {
      apply(await deleteDeliverySlot(id))
      if (form.id === id) setForm(emptySlot)
      setNote('That slot is no longer offered at checkout.')
    } catch (error) {
      onError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Checkout timing</h2>
        <p className="muted">These decide the express option and how far ahead scheduled windows appear on checkout.</p>
        <form className="admin-form" onSubmit={submitSettings}>
          <label className="field field--inline">
            <input
              type="checkbox"
              checked={settings.expressEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, expressEnabled: event.target.checked }))}
            />
            <span>Offer express delivery</span>
          </label>
          <TextField label="Express cutoff" type="time" value={settings.expressCutoff} onChange={(event) => setSettings((current) => ({ ...current, expressCutoff: event.target.value }))} required />
          <TextField label="Express ETA (minutes)" type="number" min="15" max="360" value={settings.expressEta} onChange={(event) => setSettings((current) => ({ ...current, expressEta: event.target.value }))} required />
          <TextField label="Same-day cutoff" type="time" value={settings.sameDayCutoff} onChange={(event) => setSettings((current) => ({ ...current, sameDayCutoff: event.target.value }))} required />
          <TextField label="Scheduled days ahead" type="number" min="1" max="21" value={settings.scheduledDays} onChange={(event) => setSettings((current) => ({ ...current, scheduledDays: event.target.value }))} required />
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save timing'}</Button>
        </form>
      </section>

      <section className="panel">
        <h2>{form.id ? 'Edit window' : 'Add a window'}</h2>
        <p className="muted">Active slots are the windows shown at checkout.</p>
        <form className="admin-form" onSubmit={submitSlot}>
          <TextField label="Label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} required />
          <TextField label="Starts" type="time" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} required />
          <TextField label="Ends" type="time" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} required />
          <TextField label="Capacity" type="number" min="1" max="500" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} required />
          <label className="field field--inline">
            <input type="checkbox" checked={form.sameDay} onChange={(event) => setForm((current) => ({ ...current, sameDay: event.target.checked }))} />
            <span>Same day</span>
          </label>
          <label className="field field--inline">
            <input type="checkbox" checked={form.scheduled} onChange={(event) => setForm((current) => ({ ...current, scheduled: event.target.checked }))} />
            <span>Scheduled</span>
          </label>
          <label className="field field--inline">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
            <span>Show at checkout</span>
          </label>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save window'}</Button>
            {form.id ? <Button type="button" variant="outline" onClick={() => setForm(emptySlot)}>Add another</Button> : null}
          </div>
        </form>
        {note ? <p className="pay-config__note">{note}</p> : null}
      </section>

      <section className="panel" style={{ gridColumn: '1 / -1' }}>
        <h2>Windows at checkout</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Window</th>
                <th>Capacity</th>
                <th>Offered as</th>
                <th>Checkout</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={6}>No delivery slots yet.</td>
                </tr>
              ) : null}
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <td>{slot.label}</td>
                  <td>{slot.start}–{slot.end}</td>
                  <td>{slot.capacity}</td>
                  <td>{[slot.sameDay ? 'Same day' : '', slot.scheduled ? 'Scheduled' : ''].filter(Boolean).join(', ') || '—'}</td>
                  <td>{slot.active ? 'Shown' : 'Hidden'}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setForm({
                        id: slot.id,
                        label: slot.label,
                        start: slot.start,
                        end: slot.end,
                        capacity: String(slot.capacity),
                        sameDay: slot.sameDay,
                        scheduled: slot.scheduled,
                        active: slot.active,
                      })}
                    >Edit
                    </button>
                    {' '}
                    <button type="button" className="link-button" onClick={() => remove(slot.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function toSettings(settings) {
  return {
    expressEnabled: Boolean(settings.expressEnabled),
    expressCutoff: settings.expressCutoff || '18:00',
    expressEta: String(settings.expressEta ?? 90),
    sameDayCutoff: settings.sameDayCutoff || '16:00',
    scheduledDays: String(settings.scheduledDays ?? 7),
  }
}
