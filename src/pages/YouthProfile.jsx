import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { initials, fullName, formatDate, statusClass, statusLabel, stabilityClass, todayISO } from '../lib/helpers'
import { NEED_TYPES, SERVICES, FC_STATUS, PLACEMENT_TYPES, COUNTIES, CONTACT_PREFS, STABILITY } from '../lib/constants'
import Modal, { ModalActions } from '../components/Modal'
import Spinner from '../components/Spinner'

export default function YouthProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, isAdvocate, isAdmin } = useAuth()

  const [youth, setYouth] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [advocates, setAdvocates] = useState([])
  const [availableAdvocates, setAvailableAdvocates] = useState([])
  const [loading, setLoading] = useState(true)
  const [orgs, setOrgs] = useState([])

  const [showLogNeed, setShowLogNeed] = useState(false)
  const [showAssignAdvocate, setShowAssignAdvocate] = useState(false)
  const [showCloseRef, setShowCloseRef] = useState(null)
  const [showEdit, setShowEdit] = useState(false)

  const [needForm, setNeedForm] = useState({ need_type: NEED_TYPES[0], notes: '' })
  const [closeForm, setCloseForm] = useState({ close_notes: '' })
  const [editForm, setEditForm] = useState({})
  const [advocateId, setAdvocateId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [youthRes, refRes, advocateRes, allAdvRes, orgsRes] = await Promise.all([
      supabase.from('youth').select(`
        *,
        referred_org:organizations!referred_by_org_id(id, name),
        youth_services(id, service_type)
      `).eq('id', id).single(),

      supabase.from('referrals').select(`
        *,
        logger:profiles!logged_by(first_name, last_name, org:organizations(name)),
        claimer:profiles!claimed_by(first_name, last_name, org:organizations(name))
      `).eq('youth_id', id).order('created_at', { ascending: false }),

      supabase.from('youth_advocates').select(`
        id, assigned_at,
        advocate:profiles!advocate_id(id, first_name, last_name, org:organizations(name))
      `).eq('youth_id', id),

      supabase.from('profiles').select('id, first_name, last_name, org:organizations(name)').eq('role', 'advocate').eq('status', 'active'),

      supabase.from('organizations').select('id, name').order('name'),
    ])

    const y = youthRes.data
    setYouth(y)
    setEditForm(y ?? {})
    setReferrals(refRes.data ?? [])
    setAdvocates(advocateRes.data ?? [])
    setOrgs(orgsRes.data ?? [])

    // Filter out already-assigned advocates
    const assignedIds = new Set((advocateRes.data ?? []).map(a => a.advocate?.id))
    setAvailableAdvocates((allAdvRes.data ?? []).filter(a => !assignedIds.has(a.id)))
    setLoading(false)
  }

  async function handleLogNeed() {
    if (!needForm.need_type) return
    setSaving(true)
    const { error: err } = await supabase.from('referrals').insert({
      youth_id: id,
      need_type: needForm.need_type,
      notes: needForm.notes,
      status: 'open',
      logged_by: profile?.id,
      logged_by_org_id: profile?.org_id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowLogNeed(false)
    setNeedForm({ need_type: NEED_TYPES[0], notes: '' })
    fetchAll()
  }

  async function handleClaim(refId) {
    await supabase.from('referrals').update({
      status: 'claimed',
      claimed_by: profile?.id,
      claimed_by_org_id: profile?.org_id,
      claimed_at: new Date().toISOString(),
    }).eq('id', refId)
    fetchAll()
  }

  async function handleClose() {
    if (!closeForm.close_notes) { setError('Please add resolution notes.'); return }
    setSaving(true)
    await supabase.from('referrals').update({
      status: 'closed',
      close_notes: closeForm.close_notes,
      closed_at: new Date().toISOString(),
    }).eq('id', showCloseRef)
    setSaving(false)
    setShowCloseRef(null)
    setCloseForm({ close_notes: '' })
    fetchAll()
  }

  async function handleAssignAdvocate() {
    if (!advocateId) return
    setSaving(true)
    await supabase.from('youth_advocates').insert({
      youth_id: id,
      advocate_id: advocateId,
      assigned_by: profile?.id,
    })
    setSaving(false)
    setShowAssignAdvocate(false)
    setAdvocateId('')
    fetchAll()
  }

  async function handleRemoveAdvocate(yaId) {
    if (!window.confirm('Remove this advocate assignment?')) return
    await supabase.from('youth_advocates').delete().eq('id', yaId)
    fetchAll()
  }

  async function handleSaveEdit() {
    setSaving(true)
    const { error: err } = await supabase.from('youth').update({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      preferred_name: editForm.preferred_name,
      dob: editForm.dob,
      phone: editForm.phone,
      email: editForm.email,
      zip: editForm.zip,
      contact_pref: editForm.contact_pref,
      fc_status: editForm.fc_status,
      county: editForm.county,
      placement_type: editForm.placement_type,
      placement_zip: editForm.placement_zip,
      stability: editForm.stability,
      goals: editForm.goals,
      interests: editForm.interests,
      notes: editForm.notes,
      referred_by_org_id: editForm.referred_by_org_id || null,
      last_contact: todayISO(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowEdit(false)
    fetchAll()
  }

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>
  if (!youth) return <div className="page"><div className="empty"><i className="ti ti-user-off" /><p>Youth not found</p></div></div>

  const openRefs = referrals.filter(r => r.status === 'open').length
  const closedRefs = referrals.filter(r => r.status === 'closed').length
  const services = youth.youth_services ?? []

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
          </button>
          <div className="topbar-title">{youth.preferred_name || youth.first_name} {youth.last_name}</div>
        </div>
        <div className="topbar-actions">
          {!isAdvocate && <button className="btn btn-sm" onClick={() => setShowEdit(true)}><i className="ti ti-pencil" /> Edit</button>}
          <button className="btn btn-sm btn-primary" onClick={() => setShowLogNeed(true)}>
            <i className="ti ti-plus" /> Log need
          </button>
        </div>
      </div>

      <div className="page">
        {/* Profile card */}
        <div className="card">
          <div className="profile-header">
            <div className="avatar avatar-lg">
              {initials(youth.first_name, youth.last_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div className="profile-name">
                {youth.first_name} {youth.last_name}
                {youth.preferred_name && youth.preferred_name !== youth.first_name &&
                  <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)', marginLeft: 8 }}>goes by {youth.preferred_name}</span>}
              </div>
              <div className="profile-meta">
                {youth.phone && <div className="meta-item"><i className="ti ti-phone" /> {youth.phone}</div>}
                {youth.email && <div className="meta-item"><i className="ti ti-mail" /> {youth.email}</div>}
                <div className="meta-item"><i className="ti ti-map-pin" /> {youth.county ?? '—'} County{youth.zip ? `, ${youth.zip}` : ''}</div>
                <div className="meta-item"><i className="ti ti-message" /> Prefers {youth.contact_pref}</div>
                {youth.dob && <div className="meta-item"><i className="ti ti-calendar" /> DOB: {youth.dob}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span className={`badge badge-${stabilityClass(youth.stability)}`}>{youth.stability ?? 'Unknown'}</span>
              {openRefs > 0 && <span className="badge badge-open">{openRefs} open need{openRefs > 1 ? 's' : ''}</span>}
              {closedRefs > 0 && <span className="badge badge-closed">{closedRefs} closed</span>}
            </div>
          </div>

          <div className="section-label">Foster care status &amp; placement</div>
          <div className="field-grid">
            <div className="field-item"><div className="fl">FC Status</div><div className="fv">{youth.fc_status ?? '—'}</div></div>
            <div className="field-item"><div className="fl">Placement type</div><div className="fv">{youth.placement_type ?? '—'}</div></div>
            <div className="field-item"><div className="fl">County</div><div className="fv">{youth.county ?? '—'}</div></div>
            <div className="field-item"><div className="fl">Placement zip</div><div className="fv">{youth.placement_zip ?? '—'}</div></div>
            <div className="field-item"><div className="fl">Referred by</div><div className="fv">{youth.referred_org?.name ?? '—'}</div></div>
            <div className="field-item"><div className="fl">Last contact</div><div className="fv">{formatDate(youth.last_contact)}</div></div>
          </div>

          <div className="section-label">Services &amp; needs</div>
          <div className="field-grid">
            <div className="field-item">
              <div className="fl">Currently receiving</div>
              <div className="chip-list">
                {services.length === 0 && <span style={{ fontSize: 13, color: 'var(--text3)' }}>None logged</span>}
                {services.map(s => <span key={s.id} className="chip">{s.service_type}</span>)}
              </div>
            </div>
          </div>
          {youth.notes && (
            <div style={{ marginTop: 12 }}>
              <div className="fl">Staff notes</div>
              <div className="ref-note" style={{ marginTop: 5 }}>{youth.notes}</div>
            </div>
          )}

          <div className="section-label">Personal context</div>
          <div className="field-grid">
            <div className="field-item"><div className="fl">Interests</div><div className="fv">{youth.interests || '—'}</div></div>
            <div className="field-item"><div className="fl">Goals</div><div className="fv">{youth.goals || '—'}</div></div>
          </div>
        </div>

        {/* Advocates */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Advocates <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)' }}>{advocates.length}</span></div>
            {!isAdvocate && (
              <button className="btn btn-sm" onClick={() => setShowAssignAdvocate(true)}>
                <i className="ti ti-user-plus" /> Assign advocate
              </button>
            )}
          </div>
          {advocates.length === 0 && <div className="empty" style={{ padding: '20px 0' }}><p>No advocates assigned yet</p></div>}
          {advocates.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: 'var(--border)' }}>
              <div className="avatar avatar-sm">{initials(a.advocate?.first_name, a.advocate?.last_name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fullName(a.advocate)}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{a.advocate?.org?.name} · Assigned {formatDate(a.assigned_at)}</div>
              </div>
              {!isAdvocate && (
                <button className="btn btn-sm btn-danger" onClick={() => handleRemoveAdvocate(a.id)}>Remove</button>
              )}
            </div>
          ))}
        </div>

        {/* Referrals */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Referral history <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)' }}>{referrals.length} total</span></div>
            <button className="btn btn-sm btn-primary" onClick={() => setShowLogNeed(true)}>
              <i className="ti ti-plus" /> Log need
            </button>
          </div>
          {referrals.length === 0 && <div className="empty"><i className="ti ti-inbox" /><p>No referrals logged yet</p></div>}
          {referrals.map(r => (
            <div key={r.id} className="ref-item">
              <div className="ref-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div className="ref-type">{r.need_type}</div>
                  <span className={`badge badge-${statusClass(r.status)}`}>{statusLabel(r.status)}</span>
                </div>
                <div className="ref-meta">
                  Logged by {r.logger?.org?.name ?? '—'} on {formatDate(r.created_at)}
                  {r.claimer && ` · Claimed by ${r.claimer?.org?.name} on ${formatDate(r.claimed_at)}`}
                  {r.closed_at && ` · Closed ${formatDate(r.closed_at)}`}
                </div>
                {r.notes && <div className="ref-note">{r.notes}</div>}
                {r.close_notes && <div className="ref-note ref-note-success"><strong>Resolution:</strong> {r.close_notes}</div>}
              </div>
              <div className="ref-actions">
                {r.status === 'open' && (
                  <button className="btn btn-sm btn-primary" onClick={() => handleClaim(r.id)}>Claim</button>
                )}
                {r.status === 'claimed' && r.claimed_by === profile?.id && (
                  <button className="btn btn-sm btn-success" onClick={() => { setShowCloseRef(r.id); setError('') }}>Mark closed</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log need modal */}
      {showLogNeed && (
        <Modal title="Log a need" onClose={() => setShowLogNeed(false)}>
          <div className="alert alert-info">This creates an open referral visible to all collaborative organizations.</div>
          <div className="form-group">
            <label className="form-label">Need type <span className="req">*</span></label>
            <select className="form-control" value={needForm.need_type} onChange={e => setNeedForm(f => ({ ...f, need_type: e.target.value }))}>
              {NEED_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes for other orgs</label>
            <textarea className="form-control" value={needForm.notes} onChange={e => setNeedForm(f => ({ ...f, notes: e.target.value }))} placeholder="Context that will help another org fulfill this need…" />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <ModalActions>
            <button className="btn" onClick={() => setShowLogNeed(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleLogNeed} disabled={saving}>
              <i className="ti ti-arrows-exchange" /> {saving ? 'Saving…' : 'Open referral'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* Close referral modal */}
      {showCloseRef && (
        <Modal title="Close referral" onClose={() => setShowCloseRef(null)}>
          <div className="form-group">
            <label className="form-label">Resolution notes <span className="req">*</span></label>
            <textarea className="form-control" value={closeForm.close_notes} onChange={e => setCloseForm({ close_notes: e.target.value })} placeholder="What was done? What was the outcome?" autoFocus />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <ModalActions>
            <button className="btn" onClick={() => setShowCloseRef(null)}>Cancel</button>
            <button className="btn btn-success" onClick={handleClose} disabled={saving}>
              <i className="ti ti-check" /> {saving ? 'Saving…' : 'Mark closed'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* Assign advocate modal */}
      {showAssignAdvocate && (
        <Modal title="Assign an advocate" onClose={() => setShowAssignAdvocate(false)}>
          <div className="form-group">
            <label className="form-label">Select advocate <span className="req">*</span></label>
            <select className="form-control" value={advocateId} onChange={e => setAdvocateId(e.target.value)}>
              <option value="">Choose…</option>
              {availableAdvocates.map(a => (
                <option key={a.id} value={a.id}>{a.first_name} {a.last_name} — {a.org?.name}</option>
              ))}
            </select>
          </div>
          {availableAdvocates.length === 0 && (
            <div className="alert alert-info">No additional advocates available. Add advocate-role users in Admin.</div>
          )}
          <ModalActions>
            <button className="btn" onClick={() => setShowAssignAdvocate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAssignAdvocate} disabled={saving || !advocateId}>
              {saving ? 'Saving…' : 'Assign'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* Edit youth modal */}
      {showEdit && (
        <Modal title="Edit young adult" onClose={() => setShowEdit(false)} width={560}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div className="form-group"><label className="form-label">First name</label><input className="form-control" value={editForm.first_name ?? ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Last name</label><input className="form-control" value={editForm.last_name ?? ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Preferred name</label><input className="form-control" value={editForm.preferred_name ?? ''} onChange={e => setEditForm(f => ({ ...f, preferred_name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Date of birth</label><input className="form-control" type="date" value={editForm.dob ?? ''} onChange={e => setEditForm(f => ({ ...f, dob: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-control" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Zip</label><input className="form-control" value={editForm.zip ?? ''} onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Contact pref</label>
              <select className="form-control" value={editForm.contact_pref ?? ''} onChange={e => setEditForm(f => ({ ...f, contact_pref: e.target.value }))}>
                {CONTACT_PREFS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">FC Status</label>
              <select className="form-control" value={editForm.fc_status ?? ''} onChange={e => setEditForm(f => ({ ...f, fc_status: e.target.value }))}>
                <option value="">Select…</option>
                {FC_STATUS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Stability</label>
              <select className="form-control" value={editForm.stability ?? ''} onChange={e => setEditForm(f => ({ ...f, stability: e.target.value }))}>
                {STABILITY.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">County</label>
              <select className="form-control" value={editForm.county ?? ''} onChange={e => setEditForm(f => ({ ...f, county: e.target.value }))}>
                {COUNTIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Placement type</label>
              <select className="form-control" value={editForm.placement_type ?? ''} onChange={e => setEditForm(f => ({ ...f, placement_type: e.target.value }))}>
                <option value="">Select…</option>
                {PLACEMENT_TYPES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Interests</label><input className="form-control" value={editForm.interests ?? ''} onChange={e => setEditForm(f => ({ ...f, interests: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Goals</label><input className="form-control" value={editForm.goals ?? ''} onChange={e => setEditForm(f => ({ ...f, goals: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Staff notes</label><textarea className="form-control" value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <ModalActions>
            <button className="btn" onClick={() => setShowEdit(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </ModalActions>
        </Modal>
      )}
    </div>
  )
}
