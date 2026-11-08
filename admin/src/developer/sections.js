export const developerSections = [
  { id: 'payments', label: 'Config payment' },
  { id: 'database', label: 'DB config' },
  { id: 'email', label: 'Email config' },
  { id: 'data', label: 'Farm fresh data' },
]

export function developerSection(value) {
  return developerSections.some((section) => section.id === value) ? value : 'payments'
}
