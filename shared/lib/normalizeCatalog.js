import { mediaUrl } from '../config/mediaUrl.js'

function mapCategory(category) {
  if (!category || typeof category !== 'object') return category
  return {
    ...category,
    image: mediaUrl(category.image),
    subcategories: Array.isArray(category.subcategories)
      ? category.subcategories.map((item) => ({
        ...item,
        image: mediaUrl(item.image),
      }))
      : category.subcategories,
  }
}

function mapProduct(product) {
  if (!product || typeof product !== 'object') return product
  return {
    ...product,
    image: mediaUrl(product.image),
    images: Array.isArray(product.images) ? product.images.map((url) => mediaUrl(url)) : product.images,
  }
}

export function normalizeCatalog(catalog) {
  return {
    categories: Array.isArray(catalog?.categories) ? catalog.categories.map(mapCategory) : [],
    products: Array.isArray(catalog?.products) ? catalog.products.map(mapProduct) : [],
  }
}
