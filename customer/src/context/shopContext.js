import { createContext, useContext } from 'react'

export const ShopContext = createContext(null)

export function useShop() {
  const shop = useContext(ShopContext)

  if (!shop) {
    throw new Error('useShop must be used within ShopProvider')
  }

  return shop
}
