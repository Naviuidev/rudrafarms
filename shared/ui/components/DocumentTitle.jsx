import { useEffect } from 'react'

export default function DocumentTitle({ title }) {
  useEffect(() => {
    document.title = title === 'RudrasFarmFresh' ? title : `${title} · RudrasFarmFresh`
  }, [title])

  return null
}
