import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import EmptyState from '@brand/components/EmptyState.jsx'

export default function ModulePage({ title, emptyTitle, message }) {
  return (
    <>
      <DocumentTitle title={title} />
      <div className="page-heading">
        <h1>{title}</h1>
      </div>
      <EmptyState title={emptyTitle} message={message} />
    </>
  )
}
