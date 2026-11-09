export const developerSections = [
  { id: 'overview', label: 'Overview' },
  { id: 'database', label: 'Database' },
  { id: 'payments', label: 'Razorpay' },
  { id: 'email', label: 'Email (SMTP)' },
  { id: 'data', label: 'Farm data' },
]

export function developerSection(value) {
  if (value === null || value === '' || value === undefined) {
    return 'overview'
  }
  return developerSections.some((section) => section.id === value) ? value : 'overview'
}
