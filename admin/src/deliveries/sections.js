export const deliverySections = [
  { id: 'assignments', label: 'All deliveries' },
  { id: 'upcoming', label: 'Upcoming deliveries' },
  { id: 'personnel', label: 'Delivery team' },
  { id: 'pending', label: 'Needs a driver' },
  { id: 'assignment', label: 'Assign a delivery' },
  { id: 'status', label: 'Update status' },
]

export function deliverySection(value) {
  return deliverySections.some((section) => section.id === value) ? value : 'assignments'
}
