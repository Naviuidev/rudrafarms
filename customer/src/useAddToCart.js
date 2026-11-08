import { useToast } from '@brand/toastContext.js'
import { useShop } from './context/shopContext.js'

export function useAddToCart() {
  const { addItem } = useShop()
  const showToast = useToast()

  return (product, variant) => {
    const chosen = variant || product.variants?.find((entry) => entry.isDefault) || product.variants?.[0]
    if (!chosen) return
    addItem(product.id, chosen.id)
    const unit = chosen.label || chosen.unit
    showToast({
      title: 'Added to cart',
      message: `${product.name} · ${unit}`,
    })
  }
}
