import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { statusLabel, statusClass, stabilityClass, formatDate } from '../lib/helpers'
import Spinner from '../components/Spinner'

export default function Dashboard() {
  const { profile, isAdvocate } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ youth: 0, open: 0, closed: 0, claimed: 0 })
  const [recentReferrals, setRecentReferrals] = useState([])
  const [youthList, setYouthList] = useState([])
  const [needBreakdown, setNeedBreakdown] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [youthRes, refRes, recentRes] = await Promise.all([
      supabase.from('youth').select('id, first_name, last_name, preferred_name, fc_status, county, stability, last_contact', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
      supabase.from('referrals').select('status, need_type', { count: 'exact' }),
      supabase.from('referrals').select(`
        id, need_type, status, logged_date:created_at,
        youth(id, first_name, last_name),
        logger:profiles!logged_by(first_name, last_name, org:organizations(name))
      `).order('created_at', { ascending: false }).limit(6),
    ])

    const referrals = refRes.data ?? []
    const breakdown = {}
    referrals.forEach(r => { breakdown[r.need_type] = (breakdown[r.need_type] ?? 0) + 1 })
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 6)

    setStats({
      youth: youthRes.count ?? 0,
      open: referrals.filter(r => r.status === 'open').length,
      closed: referrals.filter(r => r.status === 'closed').length,
      claimed: referrals.filter(r => r.status === 'claimed').length,
    })
    setYouthList(youthRes.data ?? [])
    setRecentReferrals(recentRes.data ?? [])
    setNeedBreakdown(sorted)
    setLoading(false)
  }

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>

  const maxNeed = needBreakdown[0]?.[1] ?? 1

  function StabilityBadge({ s }) {
    return <span className={`badge badge-${stabilityClass(s)}`}>{s ?? 'Unknown'}</span>
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left"><div className="topbar-title">Dashboard</div></div>
        <div className="topbar-actions">
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>
            Welcome back, {profile?.first_name}
          </span>
        </div>
      </div>

      <div className="page">
        <div className="stat-grid">
          <div className="stat-card" onClick={() => navigate('/youth')}>
            <div className="stat-label">Young adults in system</div>
            <div className="stat-val c-blue">{stats.youth}</div>
            <div className="stat-sub">{isAdvocate ? 'assigned to you' : 'across all orgs'} ↗</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/referrals?tab=open')}>
            <div className="stat-label">Open referrals</div>
            <div className="stat-val c-amber">{stats.open}</div>
            <div className="stat-sub">needs unclaimed ↗</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/referrals?tab=closed')}>
            <div className="stat-label">Referrals closed</div>
            <div className="stat-val c-green">{stats.closed}</div>
            <div className="stat-sub">needs fulfilled ↗</div>
          </div>
          <div className="stat-card" onClick={() => navigate('/referrals?tab=claimed')}>
            <div className="stat-label">In progress</div>
            <div className="stat-val c-gold">{stats.claimed}</div>
            <div className="stat-sub">claimed, not yet closed ↗</div>
          </div>
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent referrals</div>
              <button className="btn btn-sm" onClick={() => navigate('/referrals')}>View all</button>
            </div>
            {recentReferrals.length === 0 && <div className="empty"><i className="ti ti-inbox" /><p>No referrals yet</p></div>}
            {recentReferrals.map(r => (
              <div key={r.id} className="ref-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/youth/${r.youth?.id}`)}>
                <div className="ref-main">
                  <div className="ref-type">{r.need_type}</div>
                  <div className="ref-meta">
                    {r.youth?.first_name} {r.youth?.last_name} · {r.logger?.org?.name} · {formatDate(r.logged_date)}
                  </div>
                </div>
                <span className={`badge badge-${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Referrals by need type</div></div>
            {needBreakdown.length === 0 && <div className="empty"><i className="ti ti-chart-bar" /><p>No data yet</p></div>}
            {needBreakdown.map(([type, count]) => (
              <div key={type} className="bar-row">
                <div className="bar-label">{type}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round(count / maxNeed * 100)}%` }} /></div>
                <div className="bar-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-flush">
          <div className="card-header" style={{ padding: '16px 20px 0' }}>
            <div className="card-title">Young adults</div>
            <button className="btn btn-sm" onClick={() => navigate('/youth')}>View all</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>FC Status</th><th>County</th>
                  <th>Stability</th><th>Last contact</th>
                </tr>
              </thead>
              <tbody>
                {youthList.map(y => (
                  <tr key={y.id} className="clickable" onClick={() => navigate(`/youth/${y.id}`)}>
                    <td><strong>{y.preferred_name || y.first_name} {y.last_name}</strong></td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{y.fc_status ?? '—'}</span></td>
                    <td>{y.county ?? '—'}</td>
                    <td><StabilityBadge s={y.stability} /></td>
                    <td style={{ color: 'var(--text2)' }}>{formatDate(y.last_contact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
