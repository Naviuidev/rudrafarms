import { useState } from 'react'
import Button from '@brand/components/Button.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { ContactError, replyToContactQuery } from '../api/contactApi.js'

function formatWhen(value) {
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value || ''
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateChip(value) {
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ContactThread({
  query,
  onUpdated,
  allowReply = false,
  variant = 'default',
  detailId = '',
}) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendReply(event) {
    event.preventDefault()
    if (!allowReply || reply.trim().length < 2) return
    setBusy(true)
    setError('')
    try {
      const next = await replyToContactQuery(query.id, reply.trim())
      setReply('')
      if (next && onUpdated) onUpdated(next)
    } catch (reason) {
      setError(reason instanceof ContactError ? reason.message : 'Reply could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const rootClass = variant === 'card' || variant === 'detail'
    ? 'contact-thread support-card panel support-detail-panel'
    : 'contact-thread panel'

  return (
    <article id={detailId || undefined} className={rootClass} role="tabpanel">
      <header className="contact-thread__head support-card__head">
        <div className="support-card__titles">
          <h3>{query.topicLabel}</h3>
          <p className="muted support-card__sub">
            Started {formatDateChip(query.createdAt)}
            {query.updatedAt && query.updatedAt !== query.createdAt
              ? ` · Last update ${formatWhen(query.updatedAt)}`
              : ` · ${formatWhen(query.createdAt)}`}
          </p>
        </div>
        <span className={`support-card__status support-card__status--${query.status === 'contacted' ? 'done' : 'open'}`}>
          {query.statusLabel || query.status}
        </span>
      </header>
      <ul className="contact-thread__messages">
        {(query.messages || []).map((message) => (
          <li
            key={message.id || `${message.role}-${message.createdAt}`}
            className={message.role === 'admin' ? 'contact-bubble contact-bubble--admin' : 'contact-bubble contact-bubble--customer'}
          >
            <p className="contact-bubble__meta">
              {message.role === 'admin' ? 'Rudra\'s Farm Fresh' : 'You'}
              {' · '}
              {formatWhen(message.createdAt)}
            </p>
            <p className="contact-bubble__body">{message.body}</p>
          </li>
        ))}
      </ul>
      {allowReply ? (
        <form className="contact-thread__reply" onSubmit={sendReply} noValidate>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <TextField
            id={`contact-reply-${query.id}`}
            label="Your reply"
            multiline
            value={reply}
            onChange={(event) => setReply(event.target.value)}
          />
          <Button type="submit" disabled={busy || reply.trim().length < 2}>{busy ? 'Sending…' : 'Send reply'}</Button>
        </form>
      ) : null}
    </article>
  )
}