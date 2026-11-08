import { createContext, useContext } from 'react'

export const CatalogContext = createContext(null)

export function useCatalog() {
  const catalog = useContext(CatalogContext)
  if (!catalog) {
    throw new Error('useCatalog must be used within CatalogProvider')
  }
  return catalog
}
