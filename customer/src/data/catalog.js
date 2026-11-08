export function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function variantLabel(variant) {
  if (!variant) return ''
  return variant.label || variant.unit
}

export function cartLine(item, findProduct) {
  const product = findProduct(item.productId)
  const variant = product?.variants?.find((entry) => entry.id === item.variantId)
  if (!product || !variant) return null
  return {
    ...item,
    product: {
      ...product,
      price: variant.sellingPrice,
      mrp: variant.mrp,
      unit: variantLabel(variant),
      discount: variant.discount,
      discountPercent: variant.discountPercent,
      stock: variant.stock,
      available: variant.available,
    },
  }
}
