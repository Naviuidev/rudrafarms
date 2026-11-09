import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/** Legacy route — saved addresses live on the Account tab. */
export default function AddressesPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    const query = params.toString()
    navigate(query ? `/account?tab=addresses&${query}` : '/account?tab=addresses', { replace: true })
  }, [navigate, params])

  return null
}
