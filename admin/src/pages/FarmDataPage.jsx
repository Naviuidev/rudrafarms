import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { deleteFarmKind, deleteFarmRow, FarmDataError, farmKind, farmKinds, listFarmData } from '../api/farmDataApi.js'

const notes = {
  users: 'Deleting a user also removes that customer’s orders and subscriptions.',
  products: 'Deleting a product also removes subscription lines that use it.',
  categories: 'Deleting a category also removes its subcategories and the products in it.',
  units: 'Deleting a unit also removes the product sizes that use it.',
  orders: 'Deleting an order also removes its delivery assignments.',
  'delivery-boys': 'Deleting a delivery boy leaves the deliveries in place and clears that assignment.',
  subscriptions: 'Deleting a subscription removes its pauses, skips, and delivery days.',
  coupons: 'Deleting a coupon removes it from the shop.',
}

export default function FarmDataPage({ password }) {
  const [params, setParams] = useSearchParams()
  const kind = farmKind(params.get('kind'))
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  useEffect(() => {
    let cancel = false
    setSheet(null)
    setError('')
    listFarmData(kind, password)
      .then((next) => {
        if (!cancel) setSheet(next)
      })
      .catch((reason) => {
        if (!cancel) setError(reason instanceof FarmDataError ? reason.message : 'Farm data could not be loaded.')
      })
    return () => {
      cancel = true
    }
  }, [kind, password])

  async function confirmDelete() {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      const next = pending.id
        ? await deleteFarmRow(kind, pending.id, password)
        : await deleteFarmKind(kind, password)
      setSheet(next)
      setPending(null)
    } catch (reason) {
      setError(reason instanceof FarmDataError ? reason.message : 'That data could not be deleted.')
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const label = farmKinds.find((item) => item.id === kind)?.label || 'Users'
  const rows = sheet?.rows || []
  const columns = sheet?.columns || []

  return (
    <>
      <DocumentTitle title="Farm fresh data" />
      <div className="page-heading">
        <p className="eyebrow">Data</p>
        <h1>Farm fresh data</h1>
        <p>{notes[kind]}</p>
      </div>
      <div className="farm-kinds" role="group" aria-label="Farm data">
        {farmKinds.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={kind === item.id}
            onClick={() => setParams({ section: 'data', kind: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="page-heading page-heading--split">
          <h2>{label}</h2>
          <Button type="button" variant="danger" disabled={!rows.length || busy} onClick={() => setPending({ id: '', name: `all ${label.toLowerCase()}` })}>
            Delete all
          </Button>
        </div>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        {sheet && !rows.length ? <p className="muted">No {label.toLowerCase()} yet.</p> : null}
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => <td key={column.key}>{row[column.key] || '—'}</td>)}
                    <td>
                      <Button type="button" variant="danger" disabled={busy} onClick={() => setPending({ id: row.id, name: row.name || row.number || row.code || row.customer || 'this record' })}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <Dialog open={Boolean(pending)} title="Delete data" onClose={() => { if (!busy) setPending(null) }}>
        <p>Delete {pending?.name}? This removes it from the database and cannot be undone.</p>
        <div className="form-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
          <Button type="button" variant="danger" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </div>
      </Dialog>
    </>
  )
}
