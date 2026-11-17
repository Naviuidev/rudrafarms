import { useCallback, useEffect, useState } from 'react'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { ContactQueriesError, loadContactQueries, replyContactQuery, setContactQueryStatus } from '../api/contactQueriesApi.js'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusPill(status) {
  if (status === 'contacted') return 'contact-query__status contact-query__status--done'
  return 'contact-query__status'
}

export default function WebsiteContactQueriesPage() {
  const showToast = useToast()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [response, setResponse] = useState('')
  const [markContacted, setMarkContacted] = useState(true)
  const [replyBusy, setReplyBusy] = useState(false)

  const load = useCallback((options = {}) => {
    const silent = options.silent === true
    if (!silent) {
      setError('')
      setBusy(true)
    }
    return loadContactQueries()
      .then(setRows)
      .catch((reason) => setError(reason instanceof ContactQueriesError ? reason.message : 'Queries could not be loaded.'))
      .finally(() => {
        if (!silent) setBusy(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(() => load({ silent: true }), 15000)

  const selected = rows.find((row) => row.id === selectedId) || null

  async function sendResponse(event) {
    event.preventDefault()
    if (!selected || response.trim().length < 2) return
    setReplyBusy(true)
    try {
      const result = await replyContactQuery({
        queryId: selected.id,
        message: response.trim(),
        markContacted,
      })
      setRows(result.queries)
      setResponse('')
      showToast({
        title: 'Response sent',
        message: markContacted ? 'Marked contacted and emailed the customer (if mail is configured).' : 'Reply saved.',
      })
    } catch (reason) {
      showToast({
        title: 'Could not send',
        message: reason instanceof ContactQueriesError ? reason.message : 'Response could not be saved.',
      })
    } finally {
      setReplyBusy(false)
    }
  }

  async function toggleStatus(row) {
    const next = row.status === 'contacted' ? 'open' : 'contacted'
    try {
      const result = await setContactQueryStatus(row.id, next)
      setRows(result.queries)
    } catch (reason) {
      showToast({
        title: 'Status not updated',
        message: reason instanceof ContactQueriesError ? reason.message : 'Try again.',
      })
    }
  }

  return (
    <>
      <DocumentTitle title="Contact queries" />
      <div className="page-heading">
        <p className="eyebrow">Website</p>
        <h1>Contact queries</h1>
        <p>Messages from the contact form. Respond here; the customer sees the thread in their account and gets an email when SMTP is set up.</p>
      </div>

      {error ? <p className="field__error" role="alert">{error}</p> : null}

      <div className="panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Query</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {!busy && rows.length === 0 ? (
                <tr>
                  <td className="muted" colSpan={7}>No contact queries yet.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className={selectedId === row.id ? 'contact-query-row--active' : undefined}>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>{row.fullName}</td>
                  <td>{row.email}</td>
                  <td>{row.mobile}</td>
                  <td>{row.topicLabel}</td>
                  <td>
                    <button type="button" className={statusPill(row.status)} onClick={() => toggleStatus(row)}>
                      {row.statusLabel || row.status}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setSelectedId(row.id === selectedId ? '' : row.id)
                        setResponse('')
                      }}
                    >
                      {selectedId === row.id ? 'Close' : 'Respond'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <section className="panel contact-query-detail">
          <h2>{selected.fullName} · {selected.topicLabel}</h2>
          <p className="muted">{selected.email} · {selected.mobile}</p>

          <ul className="contact-admin-thread">
            {(selected.messages || []).map((message) => (
              <li
                key={message.id || `${message.role}-${message.createdAt}`}
                className={message.role === 'admin' ? 'contact-bubble contact-bubble--admin' : 'contact-bubble contact-bubble--customer'}
              >
                <p className="contact-bubble__meta">
                  {message.role === 'admin' ? 'Admin' : selected.fullName}
                  {' · '}
                  {formatWhen(message.createdAt)}
                </p>
                <p className="contact-bubble__body">{message.body}</p>
              </li>
            ))}
          </ul>

          <form className="form-grid contact-query-detail__form" onSubmit={sendResponse} noValidate>
            <TextField
              id="contact-admin-response"
              label="Response"
              multiline
              placeholder="Write your reply to the customer"
              value={response}
              onChange={(event) => setResponse(event.target.value)}
            />
            <label className="choice">
              <input type="checkbox" checked={markContacted} onChange={(event) => setMarkContacted(event.target.checked)} />
              <span>Mark as contacted when sending</span>
            </label>
            <Button type="submit" disabled={replyBusy || response.trim().length < 2}>
              {replyBusy ? 'Sending…' : 'Send response & email customer'}
            </Button>
          </form>
        </section>
      ) : null}
    </>
  )
}