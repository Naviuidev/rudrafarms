import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { FaqsError, deleteFaq, loadAdminFaqs, saveFaq } from '../api/faqsApi.js'
import { websiteFaqTab } from '../website/sections.js'

const faqTabs = [
  ['list', 'FAQs'],
  ['add', 'Add FAQ'],
]

const emptyFaq = {
  id: '',
  question: '',
  answer: '',
  active: true,
  sortOrder: '0',
}

function setFaqParams(setParams, { tab, id = '' }) {
  setParams(() => {
    const next = new URLSearchParams()
    next.set('section', 'faqs')
    next.set('tab', tab)
    if (id) next.set('id', id)
    return next
  })
}

export default function WebsiteFaqsPage() {
  const showToast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = websiteFaqTab(params.get('tab'))
  const editId = tab === 'add' ? (params.get('id') || '') : ''

  const [rows, setRows] = useState([])
  const [listError, setListError] = useState('')
  const [listBusy, setListBusy] = useState(false)

  const [form, setForm] = useState(emptyFaq)
  const [formError, setFormError] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const load = useCallback(() => {
    setListError('')
    setListBusy(true)
    return loadAdminFaqs()
      .then(setRows)
      .catch((reason) => setListError(reason instanceof FaqsError ? reason.message : 'FAQs could not be loaded.'))
      .finally(() => setListBusy(false))
  }, [])

  useEffect(() => {
    if (tab === 'list') load()
  }, [tab, load])

  useEffect(() => {
    if (tab !== 'add') return undefined
    if (!editId) {
      setForm(emptyFaq)
      setFormLoading(false)
      return undefined
    }
    let cancel = false
    setFormLoading(true)
    loadAdminFaqs().then((list) => {
      if (cancel) return
      const row = list.find((item) => item.id === editId)
      if (!row) {
        setFormError('That FAQ was not found.')
        setForm(emptyFaq)
      } else {
        setForm({
          id: row.id,
          question: row.question,
          answer: row.answer,
          active: row.active,
          sortOrder: String(row.sortOrder ?? 0),
        })
      }
    }).catch((reason) => {
      if (!cancel) setFormError(reason instanceof FaqsError ? reason.message : 'FAQ could not be loaded.')
    }).finally(() => {
      if (!cancel) setFormLoading(false)
    })
    return () => {
      cancel = true
    }
  }, [tab, editId])

  async function remove(id) {
    if (!id || !window.confirm('Delete this FAQ?')) return
    setListBusy(true)
    try {
      setRows(await deleteFaq(id))
      showToast({ title: 'FAQ removed', message: 'It will disappear from the shop.' })
    } catch (reason) {
      setListError(reason instanceof FaqsError ? reason.message : 'FAQ could not be deleted.')
    } finally {
      setListBusy(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setFormError('')
    setFormBusy(true)
    try {
      await saveFaq({
        id: form.id,
        question: form.question.trim(),
        answer: form.answer.trim(),
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      })
      showToast({ title: 'FAQ saved', message: form.active ? 'Visible on the shop.' : 'Saved as hidden.' })
      setForm(emptyFaq)
      setFaqParams(setParams, { tab: 'list' })
      load()
    } catch (reason) {
      setFormError(reason instanceof FaqsError ? reason.message : 'FAQ could not be saved.')
    } finally {
      setFormBusy(false)
    }
  }

  function openEdit(id) {
    setFormError('')
    setFaqParams(setParams, { tab: 'add', id })
  }

  return (
    <>
      <DocumentTitle title="FAQs" />
      <div className="page-heading">
        <p className="eyebrow">Website</p>
        <h1>FAQs</h1>
        <p>Questions and answers shown on the shop above the footer.</p>
      </div>
      <div className="panel">
        <div className="location-actions catalog-tabs" role="tablist" aria-label="FAQ sections">
          {faqTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'location-badge location-badge--active' : 'location-badge'}
              onClick={() => {
                setFaqParams(setParams, { tab: id })
                if (id === 'add' && !editId) setForm(emptyFaq)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'list' ? (
          <>
            {listError ? <p className="field__error" role="alert">{listError}</p> : null}
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Status</th>
                    <th>Order</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {!listBusy && rows.length === 0 ? (
                    <tr>
                      <td className="muted" colSpan={4}>No FAQs yet. Open the Add FAQ tab.</td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.question}</td>
                      <td>{row.active ? 'Visible' : 'Hidden'}</td>
                      <td>{row.sortOrder}</td>
                      <td>
                        <button type="button" className="text-button" onClick={() => openEdit(row.id)}>Edit</button>
                        {' · '}
                        <button type="button" className="text-button" onClick={() => remove(row.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            {formError ? <p className="field__error" role="alert">{formError}</p> : null}
            {formLoading ? <p role="status">Loading…</p> : (
              <form className="stack" onSubmit={submit}>
                <TextField
                  id="faq-question"
                  label="Question"
                  required
                  value={form.question}
                  onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
                />
                <label className="field">
                  <span className="field__label">Answer</span>
                  <textarea
                    id="faq-answer"
                    className="field__input"
                    rows={6}
                    required
                    value={form.answer}
                    onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))}
                  />
                </label>
                <TextField
                  id="faq-sort"
                  label="Display order"
                  inputMode="numeric"
                  hint="Lower numbers appear first."
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                />
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                  />
                  <span>Show on the website</span>
                </label>
                <div className="location-actions">
                  <Button type="submit" disabled={formBusy}>{formBusy ? 'Saving…' : 'Save FAQ'}</Button>
                  <Button type="button" variant="outline" onClick={() => setFaqParams(setParams, { tab: 'list' })}>Back to FAQs</Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </>
  )
}
