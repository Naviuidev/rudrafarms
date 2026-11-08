import { useCallback, useEffect, useState } from 'react'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { deleteCoupon, listCoupons, saveCoupon } from '../api/couponsApi.js'

const emptyForm = {
  id: '',
  code: '',
  discountType: 'percent',
  discountValue: '',
  maxDiscount: '',
  minimumOrder: '',
  usageLimitTotal: '',
  usageLimitPerCustomer: '',
  allowQuick: true,
  allowSubscription: true,
  active: true,
  startsAt: '',
  endsAt: '',
}

export default function CouponsPage() {
  const [rows, setRows] = useState([])
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(() => {
    setLoadError('')
    listCoupons()
      .then(setRows)
      .catch((e) => setLoadError(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function edit(row) {
    setForm({
      id: row.id || '',
      code: row.code || '',
      discountType: row.discountType || 'percent',
      discountValue: String(row.discountValue ?? ''),
      maxDiscount: String(row.maxDiscount ?? ''),
      minimumOrder: String(row.minimumOrder ?? ''),
      usageLimitTotal: row.usageLimitTotal != null ? String(row.usageLimitTotal) : '',
      usageLimitPerCustomer: row.usageLimitPerCustomer != null ? String(row.usageLimitPerCustomer) : '',
      allowQuick: Boolean(row.allowQuick),
      allowSubscription: Boolean(row.allowSubscription),
      active: Boolean(row.active),
      startsAt: row.startsAt || '',
      endsAt: row.endsAt || '',
    })
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = {
        id: form.id,
        code: form.code.trim(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        maxDiscount: form.maxDiscount === '' ? 0 : Number(form.maxDiscount) || 0,
        minimumOrder: form.minimumOrder === '' ? 0 : Number(form.minimumOrder) || 0,
        usageLimitTotal: form.usageLimitTotal === '' ? null : Number(form.usageLimitTotal),
        usageLimitPerCustomer: form.usageLimitPerCustomer === '' ? null : Number(form.usageLimitPerCustomer),
        allowQuick: form.allowQuick,
        allowSubscription: form.allowSubscription,
        active: form.active,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      }
      const next = await saveCoupon(payload)
      setRows(next)
      setForm(emptyForm)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!id || !window.confirm('Delete this coupon?')) return
    setBusy(true)
    try {
      setRows(await deleteCoupon(id))
      if (form.id === id) setForm(emptyForm)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DocumentTitle title="Coupons" />
      <div className="page-heading">
        <p className="eyebrow">Promotions</p>
        <h1>Coupons</h1>
        <p>Create percentage or fixed discounts with usage limits and channel rules.</p>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h2>{form.id ? 'Edit coupon' : 'New coupon'}</h2>
          <form className="admin-form" onSubmit={submit}>
            <TextField label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
            <label className="field">
              <span className="field__label">Discount type</span>
              <select value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}>
                <option value="percent">Percent</option>
                <option value="flat">Fixed (₹)</option>
              </select>
            </label>
            <TextField label="Value" type="number" min="1" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} required />
            <TextField label="Max discount (₹, 0 = none)" type="number" min="0" value={form.maxDiscount} onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))} />
            <TextField label="Minimum order (₹)" type="number" min="0" value={form.minimumOrder} onChange={(e) => setForm((f) => ({ ...f, minimumOrder: e.target.value }))} />
            <TextField label="Total usage limit (blank = unlimited)" type="number" min="1" value={form.usageLimitTotal} onChange={(e) => setForm((f) => ({ ...f, usageLimitTotal: e.target.value }))} />
            <TextField label="Per customer limit (blank = unlimited)" type="number" min="1" value={form.usageLimitPerCustomer} onChange={(e) => setForm((f) => ({ ...f, usageLimitPerCustomer: e.target.value }))} />
            <TextField label="Starts (YYYY-MM-DD)" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            <TextField label="Ends (YYYY-MM-DD)" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
            <label className="field field--inline">
              <input type="checkbox" checked={form.allowQuick} onChange={(e) => setForm((f) => ({ ...f, allowQuick: e.target.checked }))} />
              <span>Quick delivery</span>
            </label>
            <label className="field field--inline">
              <input type="checkbox" checked={form.allowSubscription} onChange={(e) => setForm((f) => ({ ...f, allowSubscription: e.target.checked }))} />
              <span>Subscription</span>
            </label>
            <label className="field field--inline">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <span>Active</span>
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save coupon'}</Button>
              {form.id ? (
                <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>Clear</Button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>All coupons</h2>
          {loadError ? <p className="field__error" role="alert">{loadError}</p> : null}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min</th>
                  <th>Quick</th>
                  <th>Sub</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.code}</strong></td>
                    <td>
                      {row.discountType === 'percent' ? `${row.discountValue}%` : `₹${row.discountValue}`}
                      {row.maxDiscount > 0 ? ` (max ₹${row.maxDiscount})` : ''}
                    </td>
                    <td>₹{row.minimumOrder}</td>
                    <td>{row.allowQuick ? 'Yes' : '—'}</td>
                    <td>{row.allowSubscription ? 'Yes' : '—'}</td>
                    <td>{row.active ? 'Yes' : 'No'}</td>
                    <td className="data-table__actions">
                      <button type="button" className="link-button" onClick={() => edit(row)}>Edit</button>
                      <button type="button" className="link-button" onClick={() => remove(row.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && !loadError ? <p className="muted">No database coupons yet. Legacy codes in config still work for quick cart.</p> : null}
        </section>
      </div>
    </>
  )
}
