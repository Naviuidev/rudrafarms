import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import { TextField } from '@brand/components/TextField.jsx'
import { useToast } from '@brand/toastContext.js'
import { CONTACT_TOPICS, ContactError, submitContactQuery } from '../api/contactApi.js'
import { useShop } from '../context/shopContext.js'

const HERO_IMAGE = '/images/about-hero.jpg'
const SIDE_IMAGE = '/images/about-story.jpg'

const CONTACT_DETAILS = {
  addressLines: [
    '13-1521/1, 2nd Floor-1 B C Colony.',
    'Balaji Nagar Arilova,',
    'Visakhapatnam Urban,',
    'Pin: 530040',
  ],
  phones: ['7989149573', '9014108517'],
  email: 'rudrasfarmfresh@gmail.com',
}

const emptyForm = {
  fullName: '',
  email: '',
  mobile: '',
  topicKey: '',
  message: '',
}

function ContactInfoDetails() {
  return (
    <div className="contact-aside-details panel" aria-labelledby="contact-details-title">
      <h2 id="contact-details-title" className="contact-aside-details__title">Visit or call us</h2>
      <span className="about-split__rule" aria-hidden="true" />
      <div className="contact-aside-details__grid">
        <div className="contact-details__block">
          <h3 className="contact-card__title">Address</h3>
          <p className="contact-card__body">
            {CONTACT_DETAILS.addressLines.map((line) => (
              <span key={line} className="contact-card__line">{line}</span>
            ))}
          </p>
        </div>
        <div className="contact-details__block">
          <h3 className="contact-card__title">Phone</h3>
          <p className="contact-card__body">
            {CONTACT_DETAILS.phones.map((phone) => (
              <a key={phone} className="contact-card__link" href={`tel:+91${phone}`}>{phone}</a>
            ))}
          </p>
        </div>
        <div className="contact-details__block">
          <h3 className="contact-card__title">Email</h3>
          <p className="contact-card__body">
            <a className="contact-card__link" href={`mailto:${CONTACT_DETAILS.email}`}>{CONTACT_DETAILS.email}</a>
          </p>
        </div>
      </div>
      <p className="muted contact-aside-details__about">
        Our story: <Link to="/about">About us</Link>
      </p>
    </div>
  )
}

export default function ContactPage() {
  const showToast = useToast()
  const { account } = useShop()
  const [values, setValues] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [sentId, setSentId] = useState('')

  useEffect(() => {
    if (!account) return
    setValues((current) => ({
      ...current,
      fullName: current.fullName || account.name || '',
      email: current.email || account.email || '',
      mobile: current.mobile || account.phone || '',
    }))
  }, [account])

  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function validate() {
    const next = {}
    if (values.fullName.trim().length < 2) next.fullName = 'Enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email.'
    if (!/^[6-9]\d{9}$/.test(values.mobile.replace(/\D/g, ''))) next.mobile = 'Enter a 10-digit mobile.'
    if (!values.topicKey) next.topicKey = 'Select your query type.'
    if (values.topicKey === 'custom' && values.message.trim().length < 10) {
      next.message = 'Write your message (at least 10 characters).'
    }
    return next
  }

  async function submit(event) {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      const query = await submitContactQuery({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        mobile: values.mobile.replace(/\D/g, ''),
        topicKey: values.topicKey,
        message: values.topicKey === 'custom' ? values.message.trim() : '',
      })
      setSentId(query?.id || 'ok')
      showToast({ title: 'Message sent', message: 'Rudra\'s Farm Fresh has your query. Check Account → Support for replies.' })
      setValues((current) => ({ ...emptyForm, fullName: current.fullName, email: current.email, mobile: current.mobile }))
    } catch (reason) {
      setErrors({ form: reason instanceof ContactError ? reason.message : 'Your message could not be sent.' })
    } finally {
      setBusy(false)
    }
  }

  const showMessage = values.topicKey === 'custom'

  return (
    <div className="contact-page">
      <DocumentTitle title="Contact" />

      <header
        className="about-hero"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        aria-labelledby="contact-hero-title"
      >
        <div className="about-hero__shade" aria-hidden="true" />
        <div className="about-hero__panel">
          <h1 id="contact-hero-title">Contact Us</h1>
          <p>
            Questions about deliveries, subscriptions, quick orders, or payments—we&apos;re here for families across Visakhapatnam.
          </p>
        </div>
      </header>

      <section className="about-body contact-body" aria-labelledby="contact-form-title">
        <div className="container about-split contact-split">
          <div className="contact-split__aside">
            <figure className="about-split__media contact-split__media">
              <img
                src={SIDE_IMAGE}
                alt="Rudra's Farm Fresh at sunrise"
                width="900"
                height="1200"
                loading="lazy"
                decoding="async"
              />
            </figure>
            <ContactInfoDetails />
          </div>

          <form className="panel form-grid contact-form contact-split__form" onSubmit={submit} noValidate>
            <h2 id="contact-form-title" className="about-split__title">Send a query</h2>
            <span className="about-split__rule" aria-hidden="true" />
            <p className="about-split__kicker contact-split__kicker">We reply by email and in your account support inbox</p>

            {errors.form ? <p className="field__error" role="alert">{errors.form}</p> : null}
            {sentId ? (
              <p className="success-banner" role="status">
                Thanks. Your query is recorded.
                {account ? (
                  <> View replies under <Link to="/account?tab=support">Account → Support</Link>.</>
                ) : (
                  <> <Link to="/login" state={{ from: '/support/contact' }}>Sign in</Link> with the same email to see replies.</>
                )}
              </p>
            ) : null}

            <TextField
              id="contact-full-name"
              name="fullName"
              label="Full name"
              placeholder="Your full name"
              required
              autoComplete="name"
              value={values.fullName}
              error={errors.fullName}
              onChange={update}
            />
            <TextField
              id="contact-email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              value={values.email}
              error={errors.email}
              onChange={update}
            />
            <TextField
              id="contact-mobile"
              name="mobile"
              label="Mobile number"
              placeholder="10-digit mobile number"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={values.mobile}
              error={errors.mobile}
              onChange={(event) => update({ target: { name: 'mobile', value: event.target.value.replace(/\D/g, '').slice(0, 10) } })}
            />

            <label className="field">
              <span className="field__label">Select query</span>
              <select name="topicKey" value={values.topicKey} onChange={update} aria-invalid={errors.topicKey ? 'true' : undefined}>
                <option value="">Choose one</option>
                {CONTACT_TOPICS.map((topic) => (
                  <option key={topic.value} value={topic.value}>{topic.label}</option>
                ))}
              </select>
              {errors.topicKey ? <span className="field__error">{errors.topicKey}</span> : null}
            </label>

            {showMessage ? (
              <TextField
                id="contact-message"
                name="message"
                label="Message"
                placeholder="Tell us how we can help"
                required
                multiline
                value={values.message}
                error={errors.message}
                onChange={update}
              />
            ) : null}

            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Submit'}</Button>
          </form>
        </div>
      </section>
    </div>
  )
}