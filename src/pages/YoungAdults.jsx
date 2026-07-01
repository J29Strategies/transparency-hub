import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { stabilityClass, formatDate, todayISO } from '../lib/helpers'
import { FC_STATUS, COUNTIES, CONTACT_PREFS, PLACEMENT_TYPES } from '../lib/constants'
import Modal, { ModalActions } from '../components/Modal'
import Spinner from '../components/Spinner'

export default function YoungAdults() {
  const { profile, isAdvocate } = useAuth()
  const navigate = useNavigate()
  const [youth, setYouth] = useState([])
  const [filtered, setFiltered] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name: '', last_name: '', preferred_name: '', dob: '',
    phone: '', email: '', zip: '', contact_pref: 'Text Message',
    fc_status: '', county: 'Pinellas', referred_by_org_id: '',
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [youthRes, orgsRes] = await Promise.all([
      supabase.from('youth').select(`
        id, first_name, last_name, preferred_name, fc_status,
        county, placement_type, stability, last_contact,
        referred_org:organizations!referred_by_org_id(name)
      `).order('last_name'),
      supabase.from('organizations').select('id, name').order('name'),
    ])
    setYouth(youthRes.data ?? [])
    setFiltered(youthRes.data ?? [])
    setOrgs(orgsRes.data ?? [])
    setLoading(false)
  }

  function handleSearch(q) {
    setSearch(q)
    const lower = q.toLowerCase()
    setFiltered(youth.filter(y =>
      `${y.first_name} ${y.last_name} ${y.preferred_name ?? ''} ${y.county ?? ''} ${y.fc_status ?? ''} ${y.placement_type ?? ''}`.toLowerCase().includes(lower)
    ))
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleAdd() {
    if (!form.first_name || !form.last_name) { setError('First and last name are required.'); return }
    if (!form.dob) { setError('Date of birth is required.'); return }
    if (!form.phone) { setError('Phone number is required.'); return }
    setError('')
    setSaving(true)

    const { data, error: err } = await supabase.from('youth').insert({
      ...form,
      referred_by_org_id: form.referred_by_org_id || null,
      last_contact: todayISO(),
      created_by: profile?.id,
    }).select('id').single()

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowAdd(false)
    navigate(`/youth/${data.id}`)
  }

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">{isAdvocate ? 'My Youth' : 'Young Adults'}</div>
        </div>
        <div className="topbar-actions">
          {!isAdvocate && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <i className="ti ti-plus" /> Add young adult
            </button>
          )}
        </div>
      </div>

      <div className="page">
        <div className="search-wrap">
          <i className="ti ti-search" />
          <input className="search-input" placeholder="Search by name, county, FC status…" value={search} onChange={e => handleSearch(e.target.value)} />
        </div>

        <div className="card card-flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>FC Status</th><th>County</th>
                  <th>Placement</th><th>Stability</th><th>Last contact</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6}><div className="empty"><i className="ti ti-users" /><p>No young adults found</p></div></td></tr>
                )}
                {filtered.map(y => (
                  <tr key={y.id} className="clickable" onClick={() => navigate(`/youth/${y.id}`)}>
                    <td>
                      <strong>{y.preferred_name || y.first_name} {y.last_name}</strong>
                      {y.preferred_name && y.preferred_name !== y.first_name &&
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 5 }}>({y.first_name})</span>}
                    </td>
                    <td><span className="badge badge-neutral" style={{ fontSize: 10 }}>{y.fc_status ?? '—'}</span></td>
                    <td>{y.county ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{y.placement_type ?? '—'}</td>
                    <td><span className={`badge badge-${stabilityClass(y.stability)}`}>{y.stability ?? 'Unknown'}</span></td>
                    <td style={{ color: 'var(--text2)' }}>{formatDate(y.last_contact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && (
        <Modal title="Add young adult" onClose={() => { setShowAdd(false); setError('') }}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">First name <span className="req">*</span></label>
              <input className="form-control" value={form.first_name} onChange={e => setField('first_name', e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Last name <span className="req">*</span></label>
              <input className="form-control" value={form.last_name} onChange={e => setField('last_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred name</label>
              <input className="form-control" value={form.preferred_name} onChange={e => setField('preferred_name', e.target.value)} placeholder="If different" />
            </div>
            <div className="form-group">
              <label className="form-label">Date of birth <span className="req">*</span></label>
              <input className="form-control" type="date" value={form.dob} onChange={e => setField('dob', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone <span className="req">*</span></label>
              <input className="form-control" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="727-555-0000" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setField('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Zip code</label>
              <input className="form-control" value={form.zip} maxLength={5} onChange={e => setField('zip', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred contact</label>
              <select className="form-control" value={form.contact_pref} onChange={e => setField('contact_pref', e.target.value)}>
                {CONTACT_PREFS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">FC Status</label>
              <select className="form-control" value={form.fc_status} onChange={e => setField('fc_status', e.target.value)}>
                <option value="">Select…</option>
                {FC_STATUS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">County</label>
              <select className="form-control" value={form.county} onChange={e => setField('county', e.target.value)}>
                {COUNTIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Referred by</label>
            <select className="form-control" value={form.referred_by_org_id} onChange={e => setField('referred_by_org_id', e.target.value)}>
              <option value="">Select organization…</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <ModalActions>
            <button className="btn" onClick={() => { setShowAdd(false); setError('') }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              <i className="ti ti-user-plus" /> {saving ? 'Saving…' : 'Add young adult'}
            </button>
          </ModalActions>
        </Modal>
      )}
    </div>
  )
}
