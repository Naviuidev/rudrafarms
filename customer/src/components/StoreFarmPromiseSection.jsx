const CATTLE_HERO = '/images/about-story.jpg'

const whyChooseUs = [
  'Fresh and pure raw milk from our farm to your home.',
  'Reaches your home within few hours of milking.',
  'Supplied in steel bottles filled in hygiene conditions.',
  'Delivered to your doorstep by the time the sun rises.',
  'Eco-friendly packaging.',
  'No added salt (as milk and salt are virudha aahara according to Ayurveda).',
  'No processing or cream separation.',
  'No preservatives, additives, or flavours.',
  'No added vitamins or minerals (whole milk is already a rich source of vitamins and minerals).',
]

const cattleCare = [
  'Pure pedigree (artificial insemination).',
  'Fodder grown in natural farming.',
  'Naturopathy treatment.',
  'No hormones or antibiotics given to cattle.',
  'Healthy cattle, healthy milk.',
]

export default function StoreFarmPromiseSection() {
  return (
    <section className="store-farm-promise" aria-labelledby="farm-promise-title">
      <header
        className="farm-promise__hero"
        style={{ backgroundImage: `url(${CATTLE_HERO})` }}
      >
        <div className="farm-promise__hero-shade" aria-hidden="true" />
        <div className="container farm-promise__hero-panel">
          <p className="farm-promise__eyebrow farm-promise__eyebrow--hero">Our cattle</p>
          <h2 id="farm-promise-title" className="farm-promise__title farm-promise__title--hero">
            Murrah buffaloes, Haryana heritage
          </h2>
          <p className="farm-promise__lead farm-promise__lead--hero">
            100% pure natural raw milk of Murrah buffaloes, one of the best breeds of India, got right from their place
            of origin Haryana, fed with naturally grown fodder, balanced concentrate feed and other supplements like
            calcium and minerals which make the milk more nutritious and delicious.
          </p>
        </div>
      </header>

      <div className="container store-farm-promise__inner">
        <div className="farm-promise__grid">
          <article className="farm-promise__card" aria-labelledby="farm-promise-why-title">
            <h3 id="farm-promise-why-title" className="farm-promise__card-title">
              Why do you choose us?
            </h3>
            <ul className="farm-promise__list">
              {whyChooseUs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="farm-promise__card farm-promise__card--accent" aria-labelledby="farm-promise-care-title">
            <h3 id="farm-promise-care-title" className="farm-promise__card-title">
              How do we take care of our cattle?
            </h3>
            <ul className="farm-promise__list">
              {cattleCare.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  )
}