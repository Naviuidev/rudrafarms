export const settingsSections = [
  { id: 'store', label: 'Store name' },
]

export function settingsSection(value) {
  return settingsSections.some((section) => section.id === value) ? value : 'store'
}
