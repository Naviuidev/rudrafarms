import { Link } from 'react-router-dom'

const banner = 'https://png.pngtree.com/thumb_back/fh260/background/20241224/pngtree-a-cow-dairy-farm-background-image-image_16856477.jpg'

export default function PlanBanner() {
  return (
    <section className="farm-banner" style={{ backgroundImage: `url(${banner})` }} aria-label="Farm hero">
      <div className="farm-banner__shade" />
      <div className="farm-banner__copy">
        <h1>Fresh from the farm, at your door every morning.</h1>
        <p>Cow milk, curd, vegetables, and pantry staples. Subscribe for a daily drop, or place a quick order when you need something today.</p>
        <div className="farm-banner__actions">
          <Link className="farm-banner__btn farm-banner__btn--solid" to="/subscriptions">Start a subscription</Link>
          <Link className="farm-banner__btn farm-banner__btn--line" to="/shop">Shop now</Link>
        </div>
      </div>
    </section>
  )
}
