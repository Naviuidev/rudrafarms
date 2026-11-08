export const orderSections = [
  { id: 'details', label: 'Order details' },
  { id: 'status', label: 'Update status' },
  { id: 'assign', label: 'Assign delivery' },
  { id: 'customer', label: 'Customer' },
  { id: 'address', label: 'Address' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'items', label: 'Line items' },
]

export function orderSection(value) {
  return orderSections.some((section) => section.id === value) ? value : 'details'
}
