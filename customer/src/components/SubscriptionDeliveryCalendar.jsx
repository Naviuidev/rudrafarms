import { useMemo, useState } from 'react'

function prettyDate(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return value || ''
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const LEGEND = [
  { tone: 'paused', label: 'Paused' },
  { tone: 'skipped', label: 'On hold' },
  { tone: 'delivered', label: 'Delivered' },
  { tone: 'upcoming', label: 'Upcoming' },
  { tone: 'pending', label: 'Yet to deliver' },
]

function parseYmd(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, month, day }
}

function clampMonth(year, month, minYmd, maxYmd) {
  const min = parseYmd(minYmd)
  const max = parseYmd(maxYmd)
  if (!min || !max) return { year, month }
  const minKey = min.year * 12 + min.month
  const maxKey = max.year * 12 + max.month
  const curKey = year * 12 + month
  if (curKey < minKey) return { year: min.year, month: min.month }
  if (curKey > maxKey) return { year: max.year, month: max.month }
  return { year, month }
}

function initialMonth(cycle) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const start = cycle?.periodStart || ''
  const end = cycle?.periodEnd || ''
  return clampMonth(year, month, start, end)
}

function buildMonthGrid(year, month, toneByDate, cycle) {
  const first = new Date(year, month - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i += 1) {
    cells.push({ kind: 'empty', key: `e-${i}` })
  }
  const rangeStart = cycle?.periodStart || ''
  const rangeEnd = cycle?.periodEnd || ''
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const inCycle = (!rangeStart || iso >= rangeStart) && (!rangeEnd || iso <= rangeEnd)
    const meta = toneByDate.get(iso)
    cells.push({
      kind: 'day',
      key: iso,
      day,
      iso,
      inCycle,
      tone: inCycle ? (meta?.tone || 'upcoming') : 'outside',
      label: meta?.label || '',
    })
  }
  return cells
}

function shiftMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export default function SubscriptionDeliveryCalendar({ deliveryDays = [], calendarCycle }) {
  const toneByDate = useMemo(() => {
    const map = new Map()
    deliveryDays.forEach((day) => {
      if (day?.date) map.set(day.date, day)
    })
    return map
  }, [deliveryDays])

  const [view, setView] = useState(() => initialMonth(calendarCycle))

  const periodStart = calendarCycle?.periodStart || ''
  const periodEnd = calendarCycle?.periodEnd || ''
  const { year, month } = clampMonth(view.year, view.month, periodStart, periodEnd)
  const cells = buildMonthGrid(year, month, toneByDate, calendarCycle)

  const min = parseYmd(periodStart)
  const max = parseYmd(periodEnd)
  const curKey = year * 12 + month
  const atMin = min ? curKey <= min.year * 12 + min.month : false
  const atMax = max ? curKey >= max.year * 12 + max.month : false

  const title = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))

  if (!calendarCycle?.periodStart || deliveryDays.length === 0) {
    return <p className="subs-muted">Your calendar will appear once the billing cycle is ready.</p>
  }

  return (
    <div className="subs-cal">
      <p className="subs-muted subs-cal__range">
        Billing cycle: {prettyDate(periodStart)} – {prettyDate(periodEnd)}
      </p>
      <ul className="subs-cal__legend" aria-label="Calendar legend">
        {LEGEND.map((item) => (
          <li key={item.tone} className={`subs-cal__swatch subs-cal__swatch--${item.tone}`}>{item.label}</li>
        ))}
      </ul>
      <div className="subs-cal__nav">
        <button
          type="button"
          className="subs-cal__nav-btn"
          disabled={atMin}
          aria-label="Previous month"
          onClick={() => {
            const next = shiftMonth(year, month, -1)
            setView(clampMonth(next.year, next.month, periodStart, periodEnd))
          }}
        >
          ‹
        </button>
        <strong className="subs-cal__title">{title}</strong>
        <button
          type="button"
          className="subs-cal__nav-btn"
          disabled={atMax}
          aria-label="Next month"
          onClick={() => {
            const next = shiftMonth(year, month, 1)
            setView(clampMonth(next.year, next.month, periodStart, periodEnd))
          }}
        >
          ›
        </button>
      </div>
      <div className="subs-cal__grid" role="grid" aria-label={`Delivery calendar for ${title}`}>
        {WEEKDAYS.map((name) => (
          <div key={name} className="subs-cal__weekday" role="columnheader">{name}</div>
        ))}
        {cells.map((cell) => {
          if (cell.kind === 'empty') {
            return <div key={cell.key} className="subs-cal__cell subs-cal__cell--empty" aria-hidden="true" />
          }
          const classes = [
            'subs-cal__cell',
            cell.inCycle ? `subs-cal__cell--${cell.tone}` : 'subs-cal__cell--outside',
          ].join(' ')
          const titleText = cell.label ? `${cell.iso}: ${cell.label}` : cell.iso
          return (
            <button
              key={cell.key}
              type="button"
              className={classes}
              title={titleText}
              aria-label={titleText}
              disabled
            >
              <span className="subs-cal__day-num">{cell.day}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}