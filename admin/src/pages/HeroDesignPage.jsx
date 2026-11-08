import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import Dialog from '@brand/components/Dialog.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import HeroSection from '../../../customer/src/components/HeroSection.jsx'
import {
  HeroRequestError,
  deleteHeroSection,
  loadHeroLibrary,
  publishHeroSection,
  saveHeroSection,
  uploadHeroImage,
} from '../api/heroApi.js'

const storeUrl = (import.meta.env.VITE_STORE_URL || 'http://localhost:5173').replace(/\/$/, '')

function heroFromSection(section) {
  if (!section) return null
  const { id, name, updatedAt, ...hero } = section
  return hero
}

function ImageField({ id, label, value, onChange }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function pick(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      onChange(await uploadHeroImage(file))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="design-field">
      <span className="hero-cms-label">{label}</span>
      <div className="design-field__media">
        {value ? <img src={value} alt="" className="design-thumb" /> : <span className="design-thumb design-thumb--empty">No image</span>}
        <input ref={ref} type="file" accept="image/*,.svg" hidden onChange={pick} />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => ref.current?.click()}>
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      <TextField id={id} name={id} label="Image path" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

export default function HeroDesignPage() {
  const showToast = useToast()
  const [library, setLibrary] = useState({ publishedId: '', sections: [] })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')

  useEffect(() => {
    let cancel = false
    loadHeroLibrary().then((data) => {
      if (cancel) return
      setLibrary(data)
      const initial = data.sections.find((section) => section.id === data.publishedId) || data.sections[0] || null
      setEditing(initial ? { ...initial } : null)
      setStatus('ready')
    }).catch((reason) => {
      if (cancel) return
      setError(reason instanceof HeroRequestError ? reason.message : 'The hero design could not be loaded.')
      setStatus('error')
    })
    return () => {
      cancel = true
    }
  }, [])

  const previewHero = useMemo(() => heroFromSection(editing), [editing])
  const isLive = editing?.id === library.publishedId
  const usesCover = editing && editing.layout !== 'split'
  const usesArt = editing && (editing.layout === 'split' || editing.layout === 'portrait')

  async function refresh(next, preferId) {
    setLibrary(next)
    const id = preferId || editing?.id
    const updated = next.sections.find((section) => section.id === id)
    if (updated) setEditing({ ...updated })
  }

  async function run(action, runner) {
    setBusy(action)
    try {
      return await runner()
    } catch (reason) {
      showToast({
        title: 'Hero update failed',
        message: reason instanceof HeroRequestError ? reason.message : 'Something went wrong.',
      })
      return null
    } finally {
      setBusy('')
    }
  }

  async function saveSection() {
    if (!editing) return
    const next = await run('save', () => saveHeroSection(editing))
    if (!next) return
    await refresh(next, editing.id)
    showToast({ title: 'Saved', message: `${editing.name} is ready to publish.` })
  }

  function updateField(field, value) {
    setEditing((current) => (current ? { ...current, [field]: value } : current))
  }

  function updateCta(which, field, value) {
    setEditing((current) => (
      current ? { ...current, [which]: { ...current[which], [field]: value } } : current
    ))
  }

  if (status === 'loading') {
    return (
      <div className="design-page">
        <DocumentTitle title="Hero banner" />
        <p role="status">Loading hero design…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="design-page">
        <DocumentTitle title="Hero banner" />
        <ErrorState title="Hero unavailable" message={error} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
      </div>
    )
  }

  return (
    <div className="design-page design-page--hero">
      <DocumentTitle title="Hero banner" />
      <div className="page-heading">
        <p className="eyebrow">Design</p>
        <h1>Hero banner</h1>
      </div>

      {editing && previewHero ? (
        <section className="hero-cms-studio glass-panel">
          <div className="hero-cms-studio__bar">
            <TextField
              id="hero-section-name"
              name="hero-section-name"
              label="Section name"
              value={editing.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
            <div className="hero-cms-studio__actions">
              <Button type="button" disabled={busy === 'save'} onClick={saveSection}>
                {busy === 'save' ? 'Saving…' : 'Save'}
              </Button>
              {!isLive ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy === 'publish'}
                  onClick={() => run('publish', () => publishHeroSection(editing.id)).then(async (next) => {
                    if (!next) return
                    await refresh(next, editing.id)
                    showToast({ title: 'Published', message: `${editing.name} is on the home page.` })
                  })}
                >
                  Publish
                </Button>
              ) : <span className="hero-accordion__live">Live on site</span>}
              <button type="button" className="icon-btn" title="View storefront" aria-label="View storefront" onClick={() => window.open(storeUrl, '_blank', 'noopener,noreferrer')}>
                <EyeIcon />
              </button>
            </div>
          </div>

          <div className="hero-cms-canvas">
            <HeroSection hero={previewHero} />
          </div>

          <div className="hero-cms-fields">
            <TextField id="hero-eyebrow" name="hero-eyebrow" label="Eyebrow" value={editing.eyebrow} onChange={(event) => updateField('eyebrow', event.target.value)} />
            <TextField id="hero-title" name="hero-title" label="Title" value={editing.title} onChange={(event) => updateField('title', event.target.value)} />
            <TextField id="hero-description" name="hero-description" label="Description" multiline value={editing.description} onChange={(event) => updateField('description', event.target.value)} />
            {usesCover ? (
              <ImageField id="hero-cover" label="Cover image" value={editing.backgroundImage} onChange={(value) => {
                updateField('backgroundImage', value)
                updateField('backgroundMode', value ? 'image' : 'none')
              }} />
            ) : null}
            {usesArt ? (
              <ImageField id="hero-art" label="Hero image" value={editing.heroImage} onChange={(value) => updateField('heroImage', value)} />
            ) : null}
            <TextField id="hero-primary-label" name="hero-primary-label" label="Button label" value={editing.primaryCta?.label || ''} onChange={(event) => updateCta('primaryCta', 'label', event.target.value)} />
            <TextField id="hero-primary-to" name="hero-primary-to" label="Button link" value={editing.primaryCta?.to || ''} onChange={(event) => updateCta('primaryCta', 'to', event.target.value)} />
            <TextField id="hero-secondary-label" name="hero-secondary-label" label="Second button label" value={editing.secondaryCta?.label || ''} onChange={(event) => updateCta('secondaryCta', 'label', event.target.value)} />
            <TextField id="hero-secondary-to" name="hero-secondary-to" label="Second button link" value={editing.secondaryCta?.to || ''} onChange={(event) => updateCta('secondaryCta', 'to', event.target.value)} />
          </div>
        </section>
      ) : (
        <p className="design-note">Choose a hero layout above to start designing.</p>
      )}

      <Dialog open={Boolean(confirmDelete)} title="Delete hero section?" onClose={() => setConfirmDelete('')}>
        <p className="dialog-copy">This removes the design. If it is the only one, a fresh split hero is created.</p>
        <div className="hero-background-editor__actions">
          <Button
            variant="danger"
            disabled={busy === 'delete'}
            onClick={async () => {
              const id = confirmDelete
              setConfirmDelete('')
              const next = await run('delete', () => deleteHeroSection(id))
              if (!next) return
              const fallback = next.sections.find((section) => section.id === next.publishedId) || next.sections[0]
              setLibrary(next)
              setEditing(fallback ? { ...fallback } : null)
              showToast({ title: 'Deleted', message: 'The hero section was removed.' })
            }}
          >
            Delete
          </Button>
          <Button variant="ghost" type="button" onClick={() => setConfirmDelete('')}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 11a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm0-6.5A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5z" /></svg>
  )
}
function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z" /></svg>
  )
}
