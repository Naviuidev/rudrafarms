export const websiteSections = [
  { id: 'cancelled', label: 'Canceled payments', title: 'Canceled payments', copy: 'Orders and subscription bills the customer cancelled, with the reason they chose.' },
  { id: 'pending', label: 'Pending payments', title: 'Pending payments', copy: 'Bills that are still waiting for payment.' },
  { id: 'confirmed', label: 'Order confirmed', title: 'Order confirmed', copy: 'Paid orders, from confirmation through delivery.' },
  { id: 'faqs', label: "FAQ's" },
]

const legacyFaqSections = new Set(['faqs-list', 'faqs-add'])

export function websiteSection(value) {
  if (value === 'faqs' || legacyFaqSections.has(value)) {
    return 'faqs'
  }
  return websiteSections.some((item) => item.id === value) ? value : 'cancelled'
}

export function websiteSectionIsOrders(section) {
  return section === 'cancelled' || section === 'pending' || section === 'confirmed'
}

export function websiteFaqTab(value) {
  if (value === 'add') return 'add'
  if (value === 'list') return 'list'
  return 'list'
}
