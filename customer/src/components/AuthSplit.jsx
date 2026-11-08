import DocumentTitle from '@brand/components/DocumentTitle.jsx'

export default function AuthSplit({ title, children }) {
  return (
    <div className="signup">
      <DocumentTitle title={title} />
      <aside className="signup__brand">
        <div className="signup__intro">
          <h1>Farm-fresh milk and produce, on your schedule.</h1>
          <p>A monthly subscription that arrives every day, and a quick basket when you need something today.</p>
        </div>
        <figure className="signup__quote">
          <blockquote>
            <p>Cow milk is at the door before breakfast, and buffalo milk stays a separate order.</p>
          </blockquote>
          <figcaption>
            <span className="signup__avatar" aria-hidden="true">M</span>
            <span>Meera · Hosur</span>
            <span className="signup__stars" aria-label="5 stars">★★★★★</span>
          </figcaption>
        </figure>
      </aside>
      <div className="signup__panel">{children}</div>
    </div>
  )
}
