import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'

export default function NotFoundPage() {
  return (
    <section className="section">
      <DocumentTitle title="Page not found" />
      <div className="container narrow">
        <ErrorState
          title="That page is not here"
          message="The link may be out of date. The shop, subscriptions, and quick delivery are still open."
          action={<Button to="/">Go to homepage</Button>}
        />
      </div>
    </section>
  )
}
