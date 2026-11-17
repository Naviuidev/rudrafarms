import Button from '@brand/components/Button.jsx'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'

const HERO_IMAGE = '/images/about-hero.jpg'
const STORY_IMAGE = '/images/about-story.jpg'

const story = [
  'It all started in the year 2013, when I and my elder son said bye-bye to two years of breastfeeding—and one thing bothered me: the quality of packaged milk. I tried many local milk suppliers and was fed up with their malpractices of adulterating milk, from adding water and salt to hormonal injections and synthetic milk. I used to wonder why we were unable to get quality milk when we can afford it, but somehow managed.',
  'Again the same thing bothered me in the year 2022 when I had to stop breastfeeding my one-year-old younger son. I was more worried about the increased adulteration and deteriorating quality of milk in these nine to ten years.',
  'As a result, our Rudra\'s Farm Fresh has taken birth to provide a solution for the suffering of many mothers like me in Vizag—and the rest will be history.',
]

export default function AboutPage() {
  return (
    <div className="about-page">
      <DocumentTitle title="About us" />

      <header
        className="about-hero"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        aria-labelledby="about-hero-title"
      >
        <div className="about-hero__shade" aria-hidden="true" />
        <div className="about-hero__panel">
          <h1 id="about-hero-title">About Us</h1>
          <p>
            Farm-fresh milk and daily essentials for Visakhapatnam—born from a mother&apos;s search for milk she could trust for her children.
          </p>
        </div>
      </header>

      <section className="about-body" aria-labelledby="about-story-title">
        <div className="container about-split">
          <figure className="about-split__media">
            <img
              src={STORY_IMAGE}
              alt="Fresh farm milk with cows grazing at sunrise"
              width="900"
              height="1200"
              loading="lazy"
              decoding="async"
            />
          </figure>

          <div className="about-split__copy">
            <h2 id="about-story-title" className="about-split__title">This Is Rudra&apos;s Farm Fresh!</h2>
            <span className="about-split__rule" aria-hidden="true" />
            <p className="about-split__kicker">From a mother&apos;s worry to Vizag&apos;s farm-fresh promise</p>

            {story.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="about-split__para">{paragraph}</p>
            ))}

            <footer className="about-founder__byline">
              <strong>Kiran Krishna Kumari</strong>
              <span>Founder and proprietor, Rudra&apos;s Farm Fresh</span>
            </footer>

            <div className="about-cta">
              <Button to="/shop">Shop farm-fresh products</Button>
              <Button variant="outline" to="/support/contact">Contact us</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}