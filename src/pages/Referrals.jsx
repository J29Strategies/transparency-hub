import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { statusClass, statusLabel, formatDate } from '../lib/helpers'
import Modal, { ModalActions } from '../components/Modal'
import Spinner from '../components/Spinner'

export default function Referrals() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'open')
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showClose, setShowClose] = useState(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchReferrals() }, [tab])

  function switchTab(t) {
    setTab(t)
    setSearchParams({ tab: t })
  }

  async function fetchReferrals() {
    setLoading(true)
    const statusMap = { open: 'open', claimed: 'claimed', closed: 'closed' }
    const { data } = await supabase
      .from('referrals')
      .select(`
        *,
        youth(id, first_name, last_name, preferred_name),
        logger:profiles!logged_by(first_name, last_name, org:organizations(name)),
        claimer:profiles!claimed_by(first_name, last_name, org:organizations(name))
      `)
      .eq('status', statusMap[tab] ?? 'open')
      .order('created_at', { ascending: false })

    setReferrals(data ?? [])
    setLoading(false)
  }

  async function handleClaim(refId) {
    await supabase.from('referrals').update({
      status: 'claimed',
      claimed_by: profile?.id,
      claimed_by_org_id: profile?.org_id,
      claimed_at: new Date().toISOString(),
    }).eq('id', refId)
    fetchReferrals()
  }

  async function handleClose() {
    if (!closeNotes) { setError('Resolution notes are required.'); return }
    setSaving(true)
    await supabase.from('referrals').update({
      status: 'closed',
      close_notes: closeNotes,
      closed_at: new Date().toISOString(),
    }).eq('id', showClose)
    setSaving(false)
    setShowClose(null)
    setCloseNotes('')
    fetchReferrals()
  }

  const counts = { open: 0, claimed: 0, closed: 0 }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left"><div className="topbar-title">Referrals</div></div>
      </div>
      <div className="page">
        <div className="tabs">
          {['open','claimed','closed'].map(t => (
            <button key={t} className={`tab${tab===t?' active':''}`} onClick={() => switchTab(t)}>
              {t === 'open' ? 'Open' : t === 'claimed' ? 'In progress' : 'Closed'}
            </button>
          ))}
        </div>

        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          : referrals.length === 0
            ? <div className="empty"><i className="ti ti-inbox" /><p>No referrals in this category</p></div>
            : (
              <div className="card card-flush">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Need type</th>
                        <th>Young adult</th>
                        <th>Logged by</th>
                        <th>Date</th>
                        {tab === 'claimed' && <th>Claimed by</th>}
                        {tab === 'closed' && <th>Closed</th>}
                        {tab !== 'closed' && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map(r => {
                        const youthName = r.youth?.preferred_name || r.youth?.first_name
                        return (
                          <tr key={r.id} className="clickable" onClick={() => navigate(`/youth/${r.youth?.id}`)}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{r.need_type}</div>
                              {r.notes && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{r.notes.slice(0, 70)}{r.notes.length > 70 ? '…' : ''}</div>}
                            </td>
                            <td><strong>{youthName} {r.youth?.last_name}</strong></td>
                            <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.logger?.org?.name ?? '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(r.created_at)}</td>
                            {tab === 'claimed' && <td style={{ fontSize: 12 }}>{r.claimer?.org?.name ?? '—'}</td>}
                            {tab === 'closed' && <td style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(r.closed_at)}</td>}
                            {tab === 'open' && (
                              <td onClick={e => e.stopPropagation()}>
                                <button className="btn btn-sm btn-primary" onClick={() => handleClaim(r.id)}>Claim</button>
                              </td>
                            )}
                            {tab === 'claimed' && r.claimed_by === profile?.id && (
                              <td onClick={e => e.stopPropagation()}>
                                <button className="btn btn-sm btn-success" onClick={() => { setShowClose(r.id); setError('') }}>Mark closed</button>
                              </td>
                            )}
                            {tab === 'claimed' && r.claimed_by !== profile?.id && <td />}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
      </div>

      {showClose && (
        <Modal title="Close referral" onClose={() => setShowClose(null)}>
          <div className="form-group">
            <label className="form-label">Resolution notes <span className="req">*</span></label>
            <textarea className="form-control" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="What was done? What was the outcome?" autoFocus />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <ModalActions>
            <button className="btn" onClick={() => setShowClose(null)}>Cancel</button>
            <button className="btn btn-success" onClick={handleClose} disabled={saving}>
              <i className="ti ti-check" /> {saving ? 'Saving…' : 'Mark closed'}
            </button>
          </ModalActions>
        </Modal>
      )}
    </div>
  )
}
