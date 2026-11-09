import { useEffect, useRef, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { SelectField, TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { mediaUrl } from '@shared/config/mediaUrl.js'
import { loadAdminCatalog, saveAdminCatalog, uploadCatalogImage } from '../api/catalogApi.js'

const tabs = [
  ['products', 'Products'],
  ['categories', 'Categories'],
  ['subcategories', 'Subcategories'],
  ['units', 'Units'],
]

function rupees(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
}

function catalogImage(src) {
  return mediaUrl(src)
}

function blankVariant(unitId, isDefault = false) {
  return { id: '', unitId, label: '', mrp: '', sellingPrice: '', stock: '0', available: true, active: true, isDefault }
}

function blankProduct(unitId) {
  return {
    id: '',
    name: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    images: '',
    featured: false,
    popular: false,
    bestseller: false,
    subscription: false,
    quickDelivery: true,
    active: true,
    variants: [blankVariant(unitId, true)],
  }
}

function productDraft(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId || '',
    images: product.images.join('\n'),
    featured: product.featured,
    popular: product.popular,
    bestseller: product.bestseller,
    subscription: product.subscription,
    quickDelivery: product.quickDelivery,
    active: product.active,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      unitId: variant.unitId,
      label: variant.label,
      mrp: String(variant.mrp),
      sellingPrice: String(variant.sellingPrice),
      stock: String(variant.stock),
      available: variant.available,
      active: variant.active,
      isDefault: variant.isDefault,
    })),
  }
}

export default function CatalogPage() {
  const showToast = useToast()
  const [state, setState] = useState({ status: 'loading', units: [], categories: [], products: [], error: '' })
  const [tab, setTab] = useState('products')
  const [editor, setEditor] = useState(null)
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState('')

  useEffect(() => {
    let cancel = false
    loadAdminCatalog().then((catalog) => {
      if (!cancel) setState({ status: 'ready', ...catalog, error: '' })
    }).catch((reason) => {
      if (!cancel) {
        setState({
          status: 'error',
          units: [],
          categories: [],
          products: [],
          error: reason instanceof Error ? reason.message : 'The catalog is unavailable.',
        })
      }
    })
    return () => {
      cancel = true
    }
  }, [])

  function apply(catalog) {
    setState({ status: 'ready', ...catalog, error: '' })
  }

  function openEditor(next) {
    setFormError('')
    setActionError('')
    setConfirmId('')
    setEditor(next)
  }

  function closeEditor() {
    setEditor(null)
    setFormError('')
  }

  async function persist(action, body, message) {
    setSaving(true)
    setFormError('')
    setActionError('')
    const inDialog = editor !== null
    try {
      apply(await saveAdminCatalog(action, body))
      setEditor(null)
      setConfirmId('')
      showToast({ title: 'Catalog updated', message })
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'The catalog could not be saved.'
      if (inDialog) setFormError(text)
      else setActionError(text)
      setConfirmId('')
    } finally {
      setSaving(false)
    }
  }

  const subcategories = state.categories.flatMap((category) => category.subcategories.map((item) => ({
    ...item,
    categoryId: category.id,
    categoryName: category.name,
  })))
  const activeUnits = state.units.filter((unit) => unit.active)
  const unitId = activeUnits[0]?.id || ''

  return (
    <>
      <DocumentTitle title="Products" />
      <div className="page-heading">
        <p className="eyebrow">Catalog</p>
        <h1>Products</h1>
        <p>Set categories, subcategories, units, and the variants a customer can buy. Discount is the MRP minus the selling price.</p>
      </div>
      {state.status === 'loading' ? <p role="status">Loading catalog…</p> : null}
      {state.status === 'error' ? (
        <ErrorState title="The catalog is unavailable" message={state.error} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
      ) : null}
      {state.status === 'ready' ? (
        <>
          <div className="location-actions catalog-tabs" role="tablist" aria-label="Catalog sections">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'location-badge location-badge--active' : 'location-badge'} onClick={() => { setTab(id); setConfirmId(''); setActionError('') }}>
                {label}
              </button>
            ))}
          </div>
          {actionError ? <div className="form-alert catalog-alert" role="alert">{actionError}</div> : null}
          {tab === 'products' ? (
            <CatalogTable
              addLabel="Add product"
              onAdd={() => openEditor({ kind: 'product', draft: blankProduct(unitId) })}
              emptyTitle="No products yet"
              emptyMessage="Add a product with a unit, MRP, and selling price."
              columns={['Image', 'Name', 'Category', 'Subcategory', 'Price', 'Unit', 'Variants', 'Status', 'Actions']}
              rows={state.products.map((product) => [
                <Thumb key="image" src={product.image} />,
                product.name,
                product.category,
                product.subcategory || '—',
                rupees(product.price),
                product.unit,
                String(product.variants.length),
                product.active ? 'Active' : 'Inactive',
                <RowActions
                  key="actions"
                  saving={saving}
                  armed={confirmId === product.id}
                  hint="Tap Delete again to remove this product."
                  onEdit={() => openEditor({ kind: 'product', draft: productDraft(product) })}
                  onDelete={() => (confirmId === product.id ? persist('delete-product', { id: product.id }, `${product.name} was removed.`) : setConfirmId(product.id))}
                />,
              ])}
            />
          ) : null}
          {tab === 'categories' ? (
            <CatalogTable
              addLabel="Add category"
              onAdd={() => openEditor({ kind: 'category', draft: { id: '', name: '', image: '', active: true } })}
              emptyTitle="No categories yet"
              emptyMessage="Save one here, then use it on a product."
              columns={['Image', 'Name', 'Subcategories', 'Status', 'Actions']}
              rows={state.categories.map((item) => [
                <Thumb key="image" src={item.image} />,
                item.name,
                String(item.subcategories.length),
                item.active ? 'Active' : 'Inactive',
                <RowActions
                  key="actions"
                  saving={saving}
                  armed={confirmId === item.id}
                  hint="Tap Delete again to remove this category."
                  onEdit={() => openEditor({ kind: 'category', draft: { id: item.id, name: item.name, image: item.image || '', active: item.active } })}
                  onDelete={() => (confirmId === item.id ? persist('delete-category', { id: item.id }, `${item.name} was removed.`) : setConfirmId(item.id))}
                />,
              ])}
            />
          ) : null}
          {tab === 'subcategories' ? (
            <CatalogTable
              addLabel="Add subcategory"
              onAdd={() => openEditor({ kind: 'subcategory', draft: { id: '', categoryId: state.categories[0]?.id || '', name: '', active: true } })}
              emptyTitle="No subcategories yet"
              emptyMessage="Save one here, then use it on a product."
              columns={['Name', 'Category', 'Status', 'Actions']}
              rows={subcategories.map((item) => [
                item.name,
                item.categoryName,
                item.active ? 'Active' : 'Inactive',
                <RowActions
                  key="actions"
                  saving={saving}
                  armed={confirmId === item.id}
                  hint="Tap Delete again to remove this subcategory."
                  onEdit={() => openEditor({ kind: 'subcategory', draft: { id: item.id, categoryId: item.categoryId, name: item.name, active: item.active } })}
                  onDelete={() => (confirmId === item.id ? persist('delete-subcategory', { id: item.id }, `${item.name} was removed.`) : setConfirmId(item.id))}
                />,
              ])}
            />
          ) : null}
          {tab === 'units' ? (
            <CatalogTable
              addLabel="Add unit"
              onAdd={() => openEditor({ kind: 'unit', draft: { id: '', name: '', active: true } })}
              emptyTitle="No units yet"
              emptyMessage="Save one here, then use it on a product."
              columns={['Name', 'Status', 'Actions']}
              rows={state.units.map((item) => [
                item.name,
                item.active ? 'Active' : 'Inactive',
                <RowActions
                  key="actions"
                  saving={saving}
                  armed={confirmId === item.id}
                  hint="Tap Delete again to remove this unit."
                  onEdit={() => openEditor({ kind: 'unit', draft: { id: item.id, name: item.name, active: item.active } })}
                  onDelete={() => (confirmId === item.id ? persist('delete-unit', { id: item.id }, `${item.name} was removed.`) : setConfirmId(item.id))}
                />,
              ])}
            />
          ) : null}
        </>
      ) : null}

      <Dialog open={Boolean(editor)} title={editorTitle(editor)} onClose={closeEditor} className="dialog--catalog">
        {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
        {editor?.kind === 'unit' ? (
          <NameForm
            id="unit-name"
            label="Unit"
            draft={editor.draft}
            saving={saving}
            onChange={(draft) => setEditor({ ...editor, draft })}
            onSubmit={(event) => {
              event.preventDefault()
              persist('save-unit', { unit: editor.draft }, 'The unit was saved.')
            }}
          />
        ) : null}
        {editor?.kind === 'category' ? (
          <NameForm
            id="category-name"
            label="Category"
            image
            draft={editor.draft}
            saving={saving}
            onChange={(draft) => setEditor({ ...editor, draft })}
            onSubmit={(event) => {
              event.preventDefault()
              persist('save-category', { category: editor.draft }, 'The category was saved.')
            }}
          />
        ) : null}
        {editor?.kind === 'subcategory' ? (
          <form className="catalog-form" onSubmit={(event) => { event.preventDefault(); persist('save-subcategory', { subcategory: editor.draft }, 'The subcategory was saved.') }} noValidate>
            <SelectField id="subcategory-category" label="Category" value={editor.draft.categoryId} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, categoryId: event.target.value } })}>
              {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </SelectField>
            <TextField id="subcategory-name" label="Subcategory" required value={editor.draft.name} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, name: event.target.value } })} />
            <label className="check-row">
              <input type="checkbox" checked={editor.draft.active} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, active: event.target.checked } })} />
              <span>Active</span>
            </label>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save subcategory'}</Button>
          </form>
        ) : null}
        {editor?.kind === 'product' ? (
          <ProductForm
            draft={editor.draft}
            categories={state.categories}
            units={state.units}
            saving={saving}
            onChange={(draft) => setEditor({ ...editor, draft })}
            onSubmit={(event) => {
              event.preventDefault()
              const product = {
                ...editor.draft,
                images: editor.draft.images.split('\n').map((line) => line.trim()).filter(Boolean),
                variants: editor.draft.variants.map((variant) => ({
                  ...variant,
                  mrp: Number(variant.mrp),
                  sellingPrice: Number(variant.sellingPrice),
                  stock: Number(variant.stock),
                })),
              }
              persist('save-product', { product }, 'The product was saved.')
            }}
          />
        ) : null}
      </Dialog>
    </>
  )
}

function editorTitle(editor) {
  if (!editor) return ''
  const names = { product: 'product', category: 'category', subcategory: 'subcategory', unit: 'unit' }
  return `${editor.draft.id ? 'Edit' : 'Add'} ${names[editor.kind]}`
}

function CatalogTable({ addLabel, onAdd, emptyTitle, emptyMessage, columns, rows }) {
  return (
    <section className="catalog-section">
      <Button className="catalog-add" onClick={onAdd}>{addLabel}</Button>
      {rows.length === 0 ? <EmptyState title={emptyTitle} message={emptyMessage} /> : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                {columns.map((column) => <th key={column} scope="col">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, index) => (
                <tr key={index}>
                  {cells.map((cell, cellIndex) => <td key={columns[cellIndex]}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Thumb({ src }) {
  if (!src) return <span className="catalog-thumb catalog-thumb--empty" aria-hidden="true" />
  return <img className="catalog-thumb" src={catalogImage(src)} alt="" width="48" height="48" />
}

function RowActions({ saving, armed, hint, onEdit, onDelete }) {
  return (
    <div className="catalog-actions">
      <Button variant="outline" onClick={onEdit}>Edit</Button>
      <Button variant="ghost" disabled={saving} onClick={onDelete}>{armed ? 'Confirm delete' : 'Delete'}</Button>
      {armed ? <p className="catalog-confirm">{hint}</p> : null}
    </div>
  )
}

function NameForm({ id, label, draft, saving, onChange, onSubmit, image = false }) {
  return (
    <form className="catalog-form" onSubmit={onSubmit} noValidate>
      <TextField id={id} label={label} required value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      {image ? (
        <ImagePaths
          id={`${id}-image`}
          label="Category image"
          value={draft.image || ''}
          onChange={(next) => onChange({ ...draft, image: next })}
        />
      ) : null}
      <label className="check-row">
        <input type="checkbox" checked={draft.active} onChange={(event) => onChange({ ...draft, active: event.target.checked })} />
        <span>Active</span>
      </label>
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : `Save ${label.toLowerCase()}`}</Button>
    </form>
  )
}

function ImagePaths({ id, label, value, onChange, multiple = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const paths = value.split('\n').map((line) => line.trim()).filter(Boolean)

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const path = await uploadCatalogImage(file)
      onChange(multiple ? [...paths, path].join('\n') : path)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The image could not be saved.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="image-field">
      <TextField
        id={id}
        label={label}
        required={multiple}
        multiline={multiple}
        hint="Path such as /images/cow-milk.svg, or upload an SVG, JPG, PNG, or WebP."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="image-field__row">
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? 'Uploading…' : 'Upload image'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,.jpg,.jpeg,.png,.webp,image/svg+xml,image/jpeg,image/png,image/webp"
          hidden
          onChange={onFile}
        />
      </div>
      {error ? <p className="image-field__error" role="alert">{error}</p> : null}
      {paths.length > 0 ? (
        <ul className="image-preview">
          {paths.map((path) => (
            <li key={path}>
              <img src={catalogImage(path)} alt="" width="96" height="96" />
              <span>{path}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ProductForm({ draft, categories, units, saving, onChange, onSubmit }) {
  const subs = categories.find((category) => category.id === draft.categoryId)?.subcategories || []

  function update(name, value) {
    onChange({ ...draft, [name]: value })
  }

  function updateVariant(index, patch) {
    onChange({
      ...draft,
      variants: draft.variants.map((variant, itemIndex) => {
        if (patch.isDefault) return { ...variant, ...((itemIndex === index) ? patch : { isDefault: false }) }
        return itemIndex === index ? { ...variant, ...patch } : variant
      }),
    })
  }

  return (
    <form className="catalog-form" onSubmit={onSubmit} noValidate>
      <TextField id="product-name" label="Product name" required value={draft.name} onChange={(event) => update('name', event.target.value)} />
      <TextField id="product-description" label="Description" required multiline rows={2} value={draft.description} onChange={(event) => update('description', event.target.value)} />
      <div className="catalog-form__split">
        <SelectField id="product-category" label="Category" value={draft.categoryId} onChange={(event) => onChange({ ...draft, categoryId: event.target.value, subcategoryId: '' })}>
          <option value="">Choose a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </SelectField>
        <SelectField id="product-subcategory" label="Subcategory" value={draft.subcategoryId} onChange={(event) => update('subcategoryId', event.target.value)}>
          <option value="">None</option>
          {subs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectField>
      </div>
      <ImagePaths id="product-images" label="Product images" multiple value={draft.images} onChange={(next) => update('images', next)} />
      <div className="check-grid">
        {[
          ['featured', 'Featured'],
          ['popular', 'Popular on the homepage'],
          ['bestseller', 'Best seller on the homepage'],
          ['subscription', 'Subscription eligible'],
          ['quickDelivery', 'Quick-delivery eligible'],
          ['active', 'Active'],
        ].map(([name, label]) => (
          <label key={name} className="check-row">
            <input type="checkbox" checked={draft[name]} onChange={(event) => update(name, event.target.checked)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <fieldset className="variant-stack">
        <legend>Variants</legend>
        {draft.variants.map((variant, index) => (
          <div key={variant.id || index} className="variant-card">
            <SelectField id={`variant-unit-${index}`} label="Unit" value={variant.unitId} onChange={(event) => updateVariant(index, { unitId: event.target.value })}>
              <option value="">Choose a unit</option>
              {units.filter((unit) => unit.active || unit.id === variant.unitId).map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </SelectField>
            <TextField id={`variant-label-${index}`} label="Variant label" hint="Optional. Shown instead of the unit when filled." value={variant.label} onChange={(event) => updateVariant(index, { label: event.target.value })} />
            <div className="catalog-form__split">
              <TextField id={`variant-mrp-${index}`} label="MRP" inputMode="decimal" required value={variant.mrp} onChange={(event) => updateVariant(index, { mrp: event.target.value })} />
              <TextField id={`variant-price-${index}`} label="Selling price" inputMode="decimal" required value={variant.sellingPrice} onChange={(event) => updateVariant(index, { sellingPrice: event.target.value })} />
              <TextField id={`variant-stock-${index}`} label="Stock" inputMode="numeric" required value={variant.stock} onChange={(event) => updateVariant(index, { stock: event.target.value })} />
            </div>
            <div className="check-grid">
              <label className="check-row">
                <input type="checkbox" checked={variant.available} onChange={(event) => updateVariant(index, { available: event.target.checked })} />
                <span>Available</span>
              </label>
              <label className="check-row">
                <input type="checkbox" checked={variant.active} onChange={(event) => updateVariant(index, { active: event.target.checked })} />
                <span>Active</span>
              </label>
              <label className="check-row">
                <input type="radio" name="default-variant" checked={variant.isDefault} onChange={() => updateVariant(index, { isDefault: true })} />
                <span>Default variant</span>
              </label>
            </div>
            {draft.variants.length > 1 ? (
              <Button type="button" variant="ghost" onClick={() => onChange({ ...draft, variants: draft.variants.filter((_, itemIndex) => itemIndex !== index) })}>Remove variant</Button>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => onChange({ ...draft, variants: [...draft.variants, blankVariant(units.find((unit) => unit.active)?.id || '')] })}>Add variant</Button>
      </fieldset>
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</Button>
    </form>
  )
}
