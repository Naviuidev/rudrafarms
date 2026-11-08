import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import ErrorState from '@brand/components/ErrorState.jsx'

export default function NotFoundPage() {
  return (
    <>
      <DocumentTitle title="Page not found" />
      <ErrorState
        title="That page is not in the control center"
        message="Use the menu to get back to orders, subscriptions, or deliveries."
        action={<Button to="/">Back to dashboard</Button>}
      />
    </>
  )
}
