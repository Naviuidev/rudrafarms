import { useEffect, useState } from 'react'
import { loadPublicFaqs } from '../api/faqsApi.js'

export default function StoreFaqSection() {
  const [faqs, setFaqs] = useState([])
  const [openId, setOpenId] = useState('')

  useEffect(() => {
    let cancel = false
    loadPublicFaqs().then((rows) => {
      if (!cancel) setFaqs(rows)
    })
    return () => {
      cancel = true
    }
  }, [])

  if (faqs.length === 0) return null

  return (
    <section className="store-faq" aria-labelledby="store-faq-title">
      <div className="container">
        <h2 id="store-faq-title">Frequently asked questions</h2>
        <ul className="store-faq__list">
          {faqs.map((item) => {
            const expanded = openId === item.id
            return (
              <li key={item.id} className={expanded ? 'store-faq__item store-faq__item--open' : 'store-faq__item'}>
                <button
                  type="button"
                  className="store-faq__question"
                  aria-expanded={expanded}
                  onClick={() => setOpenId(expanded ? '' : item.id)}
                >
                  <span>{item.question}</span>
                  <span className="store-faq__icon" aria-hidden>+</span>
                </button>
                <div className="store-faq__collapse" aria-hidden={!expanded}>
                  <div className="store-faq__answer">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
