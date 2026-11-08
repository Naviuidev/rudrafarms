import { formatPrice } from '../data/catalog.js'

export default function CartTotals({ quote }) {
  const deliveryNote = quote.deliveryFee === 0 && quote.subtotal > 0
    ? `Free delivery on this order. It applies from ${formatPrice(quote.freeDeliveryMinimum)}.`
    : `Delivery is free from ${formatPrice(quote.freeDeliveryMinimum)}.`

  return (
    <>
      <p className="summary__row">
        <span>Subtotal</span>
        <strong>{formatPrice(quote.subtotal)}</strong>
      </p>
      {quote.discount > 0 ? (
        <p className="summary__row">
          <span>Coupon {quote.coupon.code}</span>
          <strong>−{formatPrice(quote.discount)}</strong>
        </p>
      ) : null}
      <p className="summary__row">
        <span>Delivery</span>
        <strong>{quote.deliveryFee === 0 ? 'Free' : formatPrice(quote.deliveryFee)}</strong>
      </p>
      <p className="summary__note">{deliveryNote}</p>
      <p className="summary__row">
        <span>Tax</span>
        <strong>{formatPrice(quote.tax)}</strong>
      </p>
      <p className="summary__note">{quote.tax === 0 ? 'No tax on these fresh items.' : 'Tax applies to packaged items in this order.'}</p>
      <p className="summary__row summary__total">
        <span>Payable</span>
        <strong>{formatPrice(quote.payable)}</strong>
      </p>
    </>
  )
}
