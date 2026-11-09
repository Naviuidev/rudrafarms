const DEFAULT_DELIVERY_FEE = 40

/** Recompute totals from server line prices and the cart quantities the shopper sees now. */
export function patchQuoteForItems(quote, cartItems) {
  if (!quote?.items?.length || !cartItems?.length) return quote
  const qtyByKey = Object.fromEntries(cartItems.map((item) => [item.key, item.qty]))
  let subtotal = 0
  let tax = 0
  const items = quote.items.map((line) => {
    const qty = qtyByKey[line.key] ?? line.qty
    if (!line.ok || qty < 1) {
      return { ...line, qty }
    }
    const lineTotal = line.price * qty
    const taxRatio = line.lineTotal > 0 ? line.tax / line.lineTotal : 0
    const lineTax = Math.round(lineTotal * taxRatio)
    subtotal += lineTotal
    tax += lineTax
    return { ...line, qty, lineTotal, tax: lineTax }
  })
  const discount = Number(quote.discount) || 0
  const net = Math.max(0, subtotal - discount)
  const minimum = Number(quote.freeDeliveryMinimum) || 0
  let deliveryFee = 0
  if (quote.orderKind !== 'subscription' && subtotal > 0 && net < minimum) {
    deliveryFee = quote.deliveryFee > 0 ? quote.deliveryFee : DEFAULT_DELIVERY_FEE
  }
  const payable = net + deliveryFee + tax

  return {
    ...quote,
    items,
    subtotal,
    tax,
    deliveryFee,
    payable,
  }
}
