import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadCatalog } from '../api/catalogApi.js'
import { CatalogContext } from './catalogContext.js'

export default function CatalogProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', categories: [], products: [], error: '' })

  const reload = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: '' }))
    return loadCatalog().then((catalog) => {
      setState({ status: 'ready', categories: catalog.categories, products: catalog.products, error: '' })
    }).catch((reason) => {
      setState({
        status: 'error',
        categories: [],
        products: [],
        error: reason instanceof Error ? reason.message : 'The product catalog is unavailable.',
      })
    })
  }, [])

  useEffect(() => {
    let cancel = false
    loadCatalog().then((catalog) => {
      if (!cancel) setState({ status: 'ready', categories: catalog.categories, products: catalog.products, error: '' })
    }).catch((reason) => {
      if (!cancel) {
        setState({
          status: 'error',
          categories: [],
          products: [],
          error: reason instanceof Error ? reason.message : 'The product catalog is unavailable.',
        })
      }
    })
    return () => {
      cancel = true
    }
  }, [])

  const value = useMemo(() => ({
    ...state,
    reload,
    findProduct: (id) => state.products.find((product) => product.id === id) || null,
  }), [state, reload])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
