import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentTitle from '@brand/components/DocumentTitle.jsx'
import Skeleton from '@brand/components/Skeleton.jsx'
import { fetchAdminDashboard, AdminDashboardError } from '../api/adminDashboardApi.js'
import { useLiveRefresh } from '../hooks/useLiveRefresh.js'

function todayIso() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function monthStartIso() {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-01`
}

function formatInr(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0)
}

function prettyStatus(key) {
  return String(key || '').replaceAll('_', ' ')
}

export default function DashboardPage() {
  const [from, setFrom] = useState(monthStartIso)
  const [to, setTo] = useState(todayIso)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback((options = {}) => {
    const silent = options.silent === true
    if (!silent) {
      setError('')
      setLoading(true)
    }
    fetchAdminDashboard({ from, to })
      .then(setData)
      .catch((e) => setError(e instanceof AdminDashboardError ? e.message : 'Could not load metrics.'))
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  useLiveRefresh(() => load({ silent: true }), 15000)

  const chart = useMemo(() => {
    const rows = Array.isArray(data?.salesByDay) ? data.salesByDay : []
    const max = rows.reduce((m, r) => Math.max(m, Number(r.revenue) || 0), 0) || 1
    return rows.map((r) => ({
      ...r,
      h: Math.round(((Number(r.revenue) || 0) / max) * 100),
    }))
  }, [data])

  const todayDrops = (Number(data?.subscriptionDeliveriesToday) || 0) + (Number(data?.quickDeliveriesToday) || 0)
  const subStats = data?.subscriptionByStatus || {}
  const ordStats = data?.ordersByStatus || {}

  return (
    <div className="dash">
      <DocumentTitle title="Dashboard" />
      <header className="dash-head">
        <div>
          <p className="dash-kicker">Shop overview</p>
          <h1>Today at a glance</h1>
          <p>Revenue, open bills, and what still needs a driver.</p>
        </div>
        <form className="dash-range" onSubmit={(event) => { event.preventDefault(); load() }}>
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button>
        </form>
      </header>
      {error ? <p className="field__error" role="alert">{error}</p> : null}

      <section className="dash-kpis" aria-busy={loading}>
        {loading ? <p className="sr-only">Loading summary</p> : null}
        <Kpi to="/payments" label="Collected today" value={loading ? null : formatInr(data?.revenueToday)} note="Paid orders dated today" />
        <Kpi to="/website?section=pending" label="Waiting for payment" value={loading ? null : data?.ordersPendingPayment ?? 0} note="Bills that are still open" tone="wait" />
        <Kpi to="/deliveries" label="Drops today" value={loading ? null : todayDrops} note={`${data?.quickDeliveriesToday ?? 0} quick · ${data?.subscriptionDeliveriesToday ?? 0} subscription`} />
        <Kpi to="/deliveries?section=pending" label="Needs a driver" value={loading ? null : data?.pendingDeliveryAssignments ?? 0} note="Paid work with no one assigned" tone="alert" />
      </section>

      <section className="dash-strip" aria-label="More totals">
        <Mini label="All-time revenue" value={loading ? '…' : formatInr(data?.revenueTotal)} />
        <Mini label="Revenue in range" value={loading ? '…' : formatInr(data?.revenueInRange)} />
        <Mini label="Orders" value={loading ? '…' : data?.ordersTotal ?? 0} />
        <Mini label="Delivered" value={loading ? '…' : data?.ordersCompleted ?? 0} />
        <Mini label="Active plans" value={loading ? '…' : data?.subscriptionsActive ?? 0} />
        <Mini label="Renewals in 7 days" value={loading ? '…' : data?.upcomingRenewals7d ?? 0} />
      </section>

      <div className="dash-layout">
        <section className="dash-card dash-card--chart">
          <header>
            <h2>Sales in this range</h2>
            <Link to="/orders">All orders</Link>
          </header>
          {loading ? <Skeleton style={{ height: '180px' }} /> : chart.length === 0 ? (
            <p className="dash-empty">No paid orders between these dates.</p>
          ) : (
            <div className="dash-chart">
              {chart.map((bar) => (
                <div key={bar.date} className="dash-chart__col" title={`${bar.date}: ${formatInr(bar.revenue)}`}>
                  <div className="dash-chart__bar" style={{ height: `${Math.max(bar.h, 4)}%` }} />
                  <span>{bar.date.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dash-card">
          <header>
            <h2>Orders by status</h2>
            <Link to="/orders">Open</Link>
          </header>
          {loading ? <Skeleton style={{ height: '120px' }} /> : <StatusList stats={ordStats} />}
        </section>

        <section className="dash-card">
          <header>
            <h2>Subscriptions</h2>
            <Link to="/subscriptions">Plans</Link>
          </header>
          {loading ? <Skeleton style={{ height: '120px' }} /> : <StatusList stats={subStats} empty="No subscription plans yet." />}
          {!loading ? <p className="dash-note">{data?.subscriptionsExpired ?? 0} expired</p> : null}
        </section>
      </div>

      <div className="dash-layout dash-layout--tables">
        <section className="dash-card">
          <header>
            <h2>Recent orders</h2>
            <Link to="/orders">View all</Link>
          </header>
          {loading ? <Skeleton style={{ height: '140px' }} /> : (
            <OrderTable
              rows={data?.recentOrders || []}
              empty="No orders yet."
              columns={['Order', 'Status', 'Payment', 'Amount']}
              render={(row) => (
                <>
                  <td><Link to={`/orders/${row.id}`}>{row.orderNumber}</Link></td>
                  <td><StatusPill value={row.status} /></td>
                  <td>{prettyStatus(row.paymentStatus) || '—'}</td>
                  <td>{formatInr(row.payable)}</td>
                </>
              )}
            />
          )}
        </section>

        <section className="dash-card">
          <header>
            <h2>Recent payments</h2>
            <Link to="/payments">Payments</Link>
          </header>
          {loading ? <Skeleton style={{ height: '140px' }} /> : (
            <OrderTable
              rows={data?.recentPayments || []}
              empty="No payments yet."
              columns={['Order', 'Paid', 'Amount']}
              render={(row) => (
                <>
                  <td><Link to={`/orders/${row.id}`}>{row.orderNumber}</Link></td>
                  <td>{row.paidAt ? row.paidAt.replace('T', ' ').slice(0, 16) : '—'}</td>
                  <td>{formatInr(row.payable)}</td>
                </>
              )}
            />
          )}
        </section>

        <section className="dash-card">
          <header>
            <h2>Low stock</h2>
            <Link to="/inventory">Inventory</Link>
          </header>
          {loading ? <Skeleton style={{ height: '100px' }} /> : (data?.lowStock || []).length === 0 ? (
            <p className="dash-empty">Stock is above the low threshold.</p>
          ) : (
            <ul className="dash-stock">
              {(data?.lowStock || []).map((row) => (
                <li key={`${row.productId}-${row.variantId}`}>
                  <Link to="/inventory">{row.name}</Link>
                  <strong>{row.stock} left</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Kpi({ to, label, value, note, tone = '' }) {
  return (
    <Link className={tone ? `dash-kpi dash-kpi--${tone}` : 'dash-kpi'} to={to}>
      <span>{label}</span>
      {value == null ? <Skeleton className="stat-card__skeleton" /> : <strong>{value}</strong>}
      <small>{note}</small>
    </Link>
  )
}

function Mini({ label, value }) {
  return (
    <p className="dash-mini">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  )
}

function StatusList({ stats, empty = 'No orders yet.' }) {
  const entries = Object.entries(stats)
  const max = entries.reduce((highest, [, value]) => Math.max(highest, Number(value) || 0), 0) || 1
  if (entries.length === 0) return <p className="dash-empty">{empty}</p>
  return (
    <ul className="dash-status">
      {entries.map(([key, value]) => (
        <li key={key}>
          <span>{prettyStatus(key)}</span>
          <i><b style={{ width: `${Math.round(((Number(value) || 0) / max) * 100)}%` }} /></i>
          <strong>{value}</strong>
        </li>
      ))}
    </ul>
  )
}

function StatusPill({ value }) {
  const key = String(value || '')
  const tone = key === 'delivered' || key === 'confirmed' || key === 'paid' ? 'good' : key === 'pending_payment' || key === 'cancelled' || key === 'failed' ? 'bad' : 'neutral'
  return <span className={`dash-pill dash-pill--${tone}`}>{prettyStatus(key) || '—'}</span>
}

function OrderTable({ rows, empty, columns, render }) {
  if (rows.length === 0) return <p className="dash-empty">{empty}</p>
  return (
    <div className="table-scroll">
      <table className="data-table dash-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => <tr key={row.id}>{render(row)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
