import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { initials, formatDate, statusClass, statusLabel, stabilityClass } from '../lib/helpers'
import Spinner from '../components/Spinner'

export default function AgencyProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [madeRefs, setMadeRefs] = useState([])
  const [claimedRefs, setClaimedRefs] = useState([])
  const [youthTouched, setYouthTouched] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [orgRes, madeRes, claimedRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', id).single(),
      supabase.from('referrals').select(`
        id, need_type, status, notes, created_at, closed_at, close_notes,
        youth(id, first_name, last_name, preferred_name)
      `).eq('logged_by_org_id', id).order('created_at', { ascending: false }),
      supabase.from('referrals').select(`
        id, need_type, status, close_notes, claimed_at, closed_at,
        youth(id, first_name, last_name, preferred_name)
      `).eq('claimed_by_org_id', id).order('claimed_at', { ascending: false }),
    ])

    setOrg(orgRes.data)
    setMadeRefs(madeRes.data ?? [])
    setClaimedRefs(claimedRes.data ?? [])

    // Collect unique youth IDs across both
    const youthIds = new Set([
      ...(madeRes.data ?? []).map(r => r.youth?.id),
      ...(claimedRes.data ?? []).map(r => r.youth?.id),
    ].filter(Boolean))

    if (youthIds.size > 0) {
      const { data } = await supabase.from('youth')
        .select('id, first_name, last_name, preferred_name, fc_status, county, stability')
        .in('id', [...youthIds])
      setYouthTouched(data ?? [])
    }

    setLoading(false)
  }

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>
  if (!org) return <div className="page"><div className="empty"><i className="ti ti-building" /><p>Organization not found</p></div></div>

  const closed = claimedRefs.filter(r => r.status === 'closed').length
  const inProgress = claimedRefs.filter(r => r.status === 'claimed').length
  const orgInitials = initials(org.name.split(' ')[0], org.name.split(' ')[1])

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <button className="back-btn" onClick={() => navigate('/agencies')}>
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
          </button>
          <div className="topbar-title">{org.name}</div>
        </div>
      </div>

      <div className="page">
        <div className="card">
          <div className="profile-header">
            <div className="avatar avatar-lg" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
              {orgInitials}
            </div>
            <div style={{ flex: 1 }}>
              <div className="profile-name">{org.name}</div>
              <div className="profile-meta">
                <div className="meta-item"><i className="ti ti-users" /> {youthTouched.length} young adult{youthTouched.length !== 1 ? 's' : ''} touched</div>
                <div className="meta-item"><i className="ti ti-arrows-exchange" /> {madeRefs.length} referral{madeRefs.length !== 1 ? 's' : ''} logged</div>
                <div className="meta-item"><i className="ti ti-check" /> {closed} need{closed !== 1 ? 's' : ''} fulfilled</div>
              </div>
            </div>
            <span className="badge badge-stable">{org.status}</span>
          </div>

          <div className="section-label">Activity summary</div>
          <div className="field-grid">
            <div className="field-item"><div className="fl">Referrals logged</div><div className="fv" style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>{madeRefs.length}</div></div>
            <div className="field-item"><div className="fl">Needs claimed</div><div className="fv" style={{ fontSize: 22, fontWeight: 700, color: 'var(--amber)' }}>{claimedRefs.length}</div></div>
            <div className="field-item"><div className="fl">Needs fulfilled</div><div className="fv" style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{closed}</div></div>
            <div className="field-item"><div className="fl">Currently in progress</div><div className="fv" style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{inProgress}</div></div>
          </div>
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-header"><div className="card-title">Referrals logged</div></div>
            {madeRefs.length === 0 && <div className="empty" style={{ padding: '20px 0' }}><p>None yet</p></div>}
            {madeRefs.map(r => (
              <div key={r.id} className="ref-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/youth/${r.youth?.id}`)}>
                <div className="ref-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div className="ref-type">{r.need_type}</div>
                    <span className={`badge badge-${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="ref-meta">{r.youth?.preferred_name || r.youth?.first_name} {r.youth?.last_name} · {formatDate(r.created_at)}</div>
                  {r.notes && <div className="ref-note">{r.notes.slice(0, 80)}{r.notes.length > 80 ? '…' : ''}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Needs claimed &amp; fulfilled</div></div>
            {claimedRefs.length === 0 && <div className="empty" style={{ padding: '20px 0' }}><p>None yet</p></div>}
            {claimedRefs.map(r => (
              <div key={r.id} className="ref-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/youth/${r.youth?.id}`)}>
                <div className="ref-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <div className="ref-type">{r.need_type}</div>
                    <span className={`badge badge-${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="ref-meta">{r.youth?.preferred_name || r.youth?.first_name} {r.youth?.last_name} · claimed {formatDate(r.claimed_at)}</div>
                  {r.close_notes && <div className="ref-note ref-note-success">{r.close_notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {youthTouched.length > 0 && (
          <div className="card card-flush">
            <div className="card-header" style={{ padding: '16px 20px 0' }}>
              <div className="card-title">Young adults this org has touched</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>FC Status</th><th>County</th><th>Stability</th></tr></thead>
                <tbody>
                  {youthTouched.map(y => (
                    <tr key={y.id} className="clickable" onClick={() => navigate(`/youth/${y.id}`)}>
                      <td><strong>{y.preferred_name || y.first_name} {y.last_name}</strong></td>
                      <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{y.fc_status ?? '—'}</span></td>
                      <td>{y.county ?? '—'}</td>
                      <td><span className={`badge badge-${stabilityClass(y.stability)}`}>{y.stability ?? 'Unknown'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
