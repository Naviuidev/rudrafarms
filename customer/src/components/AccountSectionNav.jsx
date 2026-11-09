const sections = [
  { id: 'profile', label: 'Profile' },
  { id: 'addresses', label: 'Saved addresses' },
]

export default function AccountSectionNav({ active, onSelect }) {
  return (
    <nav className="account-tabs" role="tablist" aria-label="Account sections">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          role="tab"
          id={`account-tab-${section.id}`}
          aria-selected={active === section.id}
          aria-controls={`account-panel-${section.id}`}
          className={active === section.id ? 'account-tabs__btn account-tabs__btn--active' : 'account-tabs__btn'}
          onClick={() => onSelect(section.id)}
        >
          {section.label}
        </button>
      ))}
    </nav>
  )
}
