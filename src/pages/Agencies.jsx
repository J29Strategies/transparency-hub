import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { initials } from '../lib/helpers'
import Spinner from '../components/Spinner'

export default function Agencies() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [orgsRes, refRes] = await Promise.all([
      supabase.from('organizations').select('id, name, status').order('name'),
      supabase.from('referrals').select('logged_by_org_id, claimed_by_org_id, status, youth_id'),
    ])

    const refs = refRes.data ?? []
    const orgData = (orgsRes.data ?? []).map(org => {
      const made = refs.filter(r => r.logged_by_org_id === org.id).length
      const claimed = refs.filter(r => r.claimed_by_org_id === org.id).length
      const closed = refs.filter(r => r.claimed_by_org_id === org.id && r.status === 'closed').length
      const inProgress = refs.filter(r => r.claimed_by_org_id === org.id && r.status === 'claimed').length
      const youthIds = new Set([
        ...refs.filter(r => r.logged_by_org_id === org.id).map(r => r.youth_id),
        ...refs.filter(r => r.claimed_by_org_id === org.id).map(r => r.youth_id),
      ])
      return { ...org, made, claimed, closed, inProgress, youthTouched: youthIds.size }
    })

    setOrgs(orgData)
    setLoading(false)
  }

  const totalMade = orgs.reduce((s, o) => s + o.made, 0)
  const totalClosed = orgs.reduce((s, o) => s + o.closed, 0)
  const maxMade = Math.max(...orgs.map(o => o.made), 1)

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left"><div className="topbar-title">Agencies</div></div>
      </div>
      <div className="page">
        <div className="stat-grid stat-grid-3">
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-label">Active organizations</div>
            <div className="stat-val c-blue">{orgs.filter(o => o.status === 'active').length}</div>
            <div className="stat-sub">in beta collaborative</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-label">Total referrals made</div>
            <div className="stat-val c-amber">{totalMade}</div>
            <div className="stat-sub">across all orgs</div>
          </div>
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-label">Total needs fulfilled</div>
            <div className="stat-val c-green">{totalClosed}</div>
            <div className="stat-sub">closed referrals</div>
          </div>
        </div>

        <div className="card card-flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Youth touched</th>
                  <th>Referrals made</th>
                  <th></th>
                  <th>Needs fulfilled</th>
                  <th>In progress</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/agencies/${o.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                          {initials(o.name.split(' ')[0], o.name.split(' ')[1])}
                        </div>
                        <strong>{o.name}</strong>
                      </div>
                    </td>
                    <td>
                      {o.youthTouched > 0
                        ? <span className="badge badge-open">{o.youthTouched}</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, minWidth: 20 }}>{o.made}</span>
                        <div className="bar-track" style={{ width: 80 }}>
                          <div className="bar-fill" style={{ width: `${Math.round(o.made / maxMade * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td />
                    <td>
                      {o.closed > 0
                        ? <span className="badge badge-closed">{o.closed}</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td>
                      {o.inProgress > 0
                        ? <span className="badge badge-claimed">{o.inProgress}</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
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
