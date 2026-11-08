import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'

const pages = {
  delivery: {
    title: 'Delivery policy',
    body: [
      'Subscription deliveries run every day of the paid period, including Sundays and holidays, unless the store has configured an exception.',
      'Quick delivery can be express, same-day, or scheduled. Slots, fees, and the free-delivery minimum depend on your service area.',
      'You can pause a subscription, resume it, or skip a single delivery date from your account once subscriptions are active.',
    ],
  },
  privacy: {
    title: 'Privacy',
    body: [
      'RudrasFarmFresh keeps the details needed to deliver: your name, mobile number, address, and order history.',
      'Payment details are handled by Razorpay. Card and UPI secrets are not stored in the storefront.',
      'Location is used only to check whether your PIN code or current area can be served.',
    ],
  },
}

export default function SupportPage() {
  const { page } = useParams()
  const showToast = useToast()
  const [values, setValues] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)

  if (page === 'contact') {
    function update(event) {
      const { name, value } = event.target
      setValues((current) => ({ ...current, [name]: value }))
    }

    function submit(event) {
      event.preventDefault()
      const next = {}
      if (values.name.trim().length < 2) next.name = 'Enter your name.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email address.'
      if (values.message.trim().length < 10) next.message = 'Tell us a little more about how we can help.'
      setErrors(next)
      if (Object.keys(next).length) return
      setSent(true)
      showToast({ title: 'Message received', message: 'Thanks for writing to RudrasFarmFresh.' })
    }

    return (
      <section className="section">
        <DocumentTitle title="Contact" />
        <div className="container narrow">
          <div className="page-intro">
            <p className="eyebrow">Support</p>
            <h1>Contact</h1>
            <p>Questions about a delivery, a subscription, or a payment can come here.</p>
          </div>
          <form className="panel form-grid" onSubmit={submit} noValidate>
            {sent ? <p className="success-banner" role="status">Thanks. Your message is noted.</p> : null}
            <TextField id="support-name" name="name" label="Name" required value={values.name} error={errors.name} onChange={update} />
            <TextField id="support-email" name="email" type="email" label="Email" required value={values.email} error={errors.email} onChange={update} />
            <TextField id="support-message" name="message" label="Message" required multiline value={values.message} error={errors.message} onChange={update} />
            <Button type="submit">Send message</Button>
          </form>
        </div>
      </section>
    )
  }

  const content = pages[page]
  if (!content) {
    return (
      <section className="section">
        <DocumentTitle title="Page not found" />
        <div className="container narrow">
          <ErrorState
            title="That page is not here"
            message="The link may be out of date. Head back to the shop or the help pages."
            action={<Button to="/">Go to homepage</Button>}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <DocumentTitle title={content.title} />
      <div className="container narrow prose">
        <p className="eyebrow">Support</p>
        <h1>{content.title}</h1>
        {content.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </section>
  )
}
