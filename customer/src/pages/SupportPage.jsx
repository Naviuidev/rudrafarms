import { useParams } from 'react-router-dom'
import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'
import ContactPage from './ContactPage.jsx'

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

  if (page === 'contact') {
    return <ContactPage />
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
