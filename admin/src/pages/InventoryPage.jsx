import { useCallback, useEffect, useMemo, useState } from 'react'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { CatalogAdminError, loadAdminCatalog } from '../api/catalogApi.js'
import { InventoryError, fetchMovements, adjustStock } from '../api/inventoryApi.js'

export default function InventoryPage() {
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [variantId, setVariantId] = useState('')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('adjustment')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const variantOptions = useMemo(() => {
    const out = []
    for (const p of products) {
      for (const v of p.variants || []) {
        out.push({
          value: v.id,
          label: `${p.name} · ${v.label || v.unit} — stock ${v.stock}`,
        })
      }
    }
    return out
  }, [products])

  const loadCatalog = useCallback(() => {
    setError('')
    return loadAdminCatalog()
      .then((data) => setProducts(data.products || []))
      .catch((e) => setError(e instanceof CatalogAdminError ? e.message : 'Catalog failed.'))
  }, [])

  const loadMovements = useCallback(() => {
    return fetchMovements({ variantId: variantId || undefined, limit: 80 })
      .then((data) => setMovements(data.movements))
      .catch((e) => setError(e instanceof InventoryError ? e.message : 'Movements failed.'))
  }, [variantId])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  async function submit(event) {
    event.preventDefault()
    const d = parseInt(delta, 10)
    if (!variantId || Number.isNaN(d) || d === 0) {
      setError('Pick a variant and a non-zero change.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await adjustStock({ variantId, delta: d, reason: reason.trim() || 'adjustment', reference: reference.trim() })
      setDelta('')
      await loadCatalog()
      await loadMovements()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DocumentTitle title="Inventory" />
      <div className="page-heading">
        <p className="eyebrow">Stock</p>
        <h1>Inventory</h1>
        <p>Adjust variant stock with a full audit trail. Positive adds, negative removes.</p>
      </div>

      {error ? <p className="field__error" role="alert">{error}</p> : null}

      <div className="admin-grid">
        <section className="panel">
          <h2>Adjust stock</h2>
          <form className="admin-form" onSubmit={submit}>
            <label className="field">
              <span className="field__label">Variant</span>
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
                <option value="">Choose…</option>
                {variantOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <TextField
              label="Change (+ add, − reduce)"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              required
            />
            <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <TextField label="Reference (invoice, PO, etc.)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Button type="submit" disabled={busy}>{busy ? 'Applying…' : 'Apply'}</Button>
          </form>
        </section>

        <section className="panel">
          <h2>Recent movements</h2>
          <p className="muted" style={{ marginTop: 0 }}>Filter by selecting a variant above, or leave unselected for all.</p>
          <Button type="button" variant="outline" onClick={() => loadMovements()} disabled={busy}>Refresh</Button>
          <div className="table-scroll" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>Product</th><th>Δ</th><th>Reason</th><th>Ref</th></tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={5}>No stock movements yet.</td>
                  </tr>
                ) : null}
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{m.createdAt}</td>
                    <td>{m.productName}</td>
                    <td>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                    <td>{m.reason}</td>
                    <td>{m.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
