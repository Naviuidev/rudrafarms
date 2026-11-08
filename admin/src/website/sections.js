export const websiteSections = [
  { id: 'cancelled', label: 'Canceled payments', title: 'Canceled payments', copy: 'Orders and subscription bills the customer cancelled, with the reason they chose.' },
  { id: 'pending', label: 'Pending payments', title: 'Pending payments', copy: 'Bills that are still waiting for payment.' },
  { id: 'confirmed', label: 'Order confirmed', title: 'Order confirmed', copy: 'Paid orders, from confirmation through delivery.' },
]

export function websiteSection(value) {
  return websiteSections.some((item) => item.id === value) ? value : 'cancelled'
}
