export const settingsSections = [
  { id: 'hours', label: 'Store hours' },
  { id: 'store', label: 'Store name' },
]

export function settingsSection(value) {
  return settingsSections.some((section) => section.id === value) ? value : 'hours'
}
