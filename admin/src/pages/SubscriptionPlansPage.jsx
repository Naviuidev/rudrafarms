import { useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { deletePlan, fetchPlans, savePlan } from '../api/subscriptionPlansApi.js'

const emptyPlan = {
  id: '',
  name: '',
  description: '',
  planType: 'fixed',
  active: true,
  sortOrder: 0,
  items: [{ productId: '', variantId: '', qty: 1 }],
}

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState([])
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    fetchPlans().then(setPlans).catch(() => setError('Plans could not be loaded.'))
  }

  useEffect(() => {
    load()
  }, [])

  function startCreate() {
    setError('')
    setEditor({ ...emptyPlan })
  }

  function startEdit(plan) {
    setError('')
    setEditor({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      planType: plan.planType || 'fixed',
      active: plan.active !== false,
      sortOrder: plan.sortOrder || 0,
      items: (plan.items && plan.items.length) ? plan.items.map((item) => ({
        productId: item.productId || '',
        variantId: item.variantId || '',
        qty: item.qty || item.dailyQty || 1,
      })) : [{ productId: '', variantId: '', qty: 1 }],
    })
  }

  async function persist() {
    if (!editor) return
    setBusy(true)
    setError('')
    try {
      await savePlan({
        id: editor.id,
        name: editor.name,
        description: editor.description,
        planType: editor.planType,
        active: editor.active,
        sortOrder: Number(editor.sortOrder) || 0,
        items: editor.items.filter((row) => row.productId && row.variantId),
      })
      setEditor(null)
      load()
    } catch (reason) {
      setError(reason?.response?.data?.message || 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this plan?')) return
    setBusy(true)
    try {
      await deletePlan(id)
      load()
    } catch (reason) {
      setError(reason?.response?.data?.message || 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <DocumentTitle title="Subscription plans" />
      <div className="container">
        <header className="page-intro">
          <p className="eyebrow">Catalog</p>
          <h1>Subscription plans</h1>
          <p>Fixed bundles customers can pick on the storefront. Use product IDs and variant IDs from the catalog.</p>
        </header>

        {error ? <p className="field__error" role="alert">{error}</p> : null}

        <div className="panel catalog-toolbar" style={{ marginBottom: '1rem' }}>
          <Button onClick={startCreate}>New plan</Button>
        </div>

        <div className="panel">
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.name}</td>
                    <td>{plan.planType}</td>
                    <td>{plan.active ? 'Yes' : 'No'}</td>
                    <td className="catalog-table__actions">
                      <Button variant="outline" onClick={() => startEdit(plan)}>Edit</Button>
                      {' '}
                      <Button variant="ghost" onClick={() => remove(plan.id)} disabled={busy}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {editor ? (
          <div className="dialog dialog--open" style={{ position: 'relative', marginTop: '1rem' }}>
            <div className="dialog__panel dialog--catalog" style={{ maxWidth: '640px' }}>
              <h2>{editor.id ? 'Edit plan' : 'New plan'}</h2>
              <TextField id="sp-name" label="Name" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              <TextField id="sp-desc" label="Description" multiline value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
              <TextField id="sp-sort" label="Sort order" value={String(editor.sortOrder)} onChange={(e) => setEditor({ ...editor, sortOrder: e.target.value })} />
              <label className="field">
                <span className="field__label">Plan type</span>
                <select className="field__input" value={editor.planType} onChange={(e) => setEditor({ ...editor, planType: e.target.value })}>
                  <option value="fixed">fixed</option>
                  <option value="custom">custom</option>
                </select>
              </label>
              <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={editor.active} onChange={(e) => setEditor({ ...editor, active: e.target.checked })} />
                Active
              </label>
              <h3>Items (product + variant UUID)</h3>
              {editor.items.map((row, index) => (
                <div key={index} className="variant-card" style={{ marginBottom: '0.5rem' }}>
                  <TextField id={`pi-${index}`} label="Product ID" value={row.productId} onChange={(e) => {
                    const next = [...editor.items]
                    next[index] = { ...next[index], productId: e.target.value }
                    setEditor({ ...editor, items: next })
                  }}
                  />
                  <TextField id={`vi-${index}`} label="Variant ID" value={row.variantId} onChange={(e) => {
                    const next = [...editor.items]
                    next[index] = { ...next[index], variantId: e.target.value }
                    setEditor({ ...editor, items: next })
                  }}
                  />
                  <TextField id={`qi-${index}`} label="Daily qty" value={String(row.qty)} onChange={(e) => {
                    const next = [...editor.items]
                    next[index] = { ...next[index], qty: Number(e.target.value) || 1 }
                    setEditor({ ...editor, items: next })
                  }}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setEditor({ ...editor, items: [...editor.items, { productId: '', variantId: '', qty: 1 }] })}>Add line</Button>
              <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
                <Button onClick={persist} disabled={busy}>Save</Button>
                <Button variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
