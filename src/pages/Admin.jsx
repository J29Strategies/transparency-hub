import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import { initials, fullName, formatDate } from '../lib/helpers'
import { ROLES } from '../lib/constants'
import Modal, { ModalActions } from '../components/Modal'
import Spinner from '../components/Spinner'

export default function Admin() {
  const { profile, isSuperAdmin, isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('users')
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const blankForm = { first_name: '', last_name: '', role: 'agency_staff', org_id: '', status: 'active' }
  const [form, setForm] = useState(blankForm)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [usersRes, orgsRes] = await Promise.all([
      supabase.from('profiles').select('*, org:organizations(id, name)').order('last_name'),
      supabase.from('organizations').select('*').order('name'),
    ])
    // Org admins only see their own org's users
    const allUsers = usersRes.data ?? []
    setUsers(isSuperAdmin ? allUsers : allUsers.filter(u => u.org_id === profile?.org_id))
    setOrgs(orgsRes.data ?? [])
    setLoading(false)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSaveUser() {
    if (!form.first_name || !form.last_name) { setError('First and last name required.'); return }
    if (!form.org_id) { setError('Organization is required.'); return }
    setSaving(true)
    setError('')

    if (editUser) {
      const { error: err } = await supabase.from('profiles').update({
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        org_id: form.org_id,
        status: form.status,
        updated_at: new Date().toISOString(),
      }).eq('id', editUser.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      // New user — they need to self-register. We can only pre-create the profile
      // if using Supabase admin API (service role). For now, show instructions.
      setError('To add a new user: have them sign up at your app URL, then update their role here.')
      setSaving(false)
      return
    }

    setSaving(false)
    setEditUser(null)
    setShowAdd(false)
    fetchData()
  }

  function openEdit(user) {
    setEditUser(user)
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      org_id: user.org_id ?? '',
      status: user.status,
    })
    setError('')
  }

  async function toggleStatus(user) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id)
    fetchData()
  }

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left"><div className="topbar-title">Admin</div></div>
        <div className="topbar-actions">
          {isSuperAdmin && (
            <span style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--blue-light)', padding: '4px 10px', borderRadius: 20, color: '#185FA5' }}>
              Super Admin
            </span>
          )}
        </div>
      </div>

      <div className="page">
        <div className="alert alert-info">
          <i className="ti ti-info-circle" style={{ fontSize: 15, verticalAlign: -2, marginRight: 4 }} />
          To add a new user: send them your app URL and have them sign up. Then find their name here and update their role and organization.
        </div>

        <div className="tabs">
          <button className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
            Users <span className="tab-count">{users.length}</span>
          </button>
          {isSuperAdmin && (
            <button className={`tab${tab === 'orgs' ? ' active' : ''}`} onClick={() => setTab('orgs')}>
              Organizations <span className="tab-count">{orgs.length}</span>
            </button>
          )}
        </div>

        {tab === 'users' && (
          <div className="card card-flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Organization</th><th>Role</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr><td colSpan={5}><div className="empty"><i className="ti ti-users" /><p>No users found</p></div></td></tr>
                  )}
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar avatar-sm">{initials(u.first_name, u.last_name)}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName(u)}</div>
                            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Joined {formatDate(u.created_at)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{u.org?.name ?? '—'}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                          {ROLES[u.role] ?? u.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${u.status === 'active' ? 'stable' : 'neutral'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {(isSuperAdmin || (isAdmin && u.org_id === profile?.org_id)) && (
                            <>
                              <button className="btn btn-sm" onClick={() => openEdit(u)}>Edit</button>
                              {u.id !== profile?.id && (
                                <button
                                  className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                  onClick={() => toggleStatus(u)}
                                >
                                  {u.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'orgs' && isSuperAdmin && (
          <div className="card card-flush">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Organization</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {orgs.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar avatar-sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                            {initials(o.name.split(' ')[0], o.name.split(' ')[1])}
                          </div>
                          <strong>{o.name}</strong>
                        </div>
                      </td>
                      <td><span className={`badge badge-${o.status === 'active' ? 'stable' : 'neutral'}`}>{o.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit user modal */}
      {editUser && (
        <Modal title={`Edit — ${fullName(editUser)}`} onClose={() => { setEditUser(null); setError('') }}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">First name</label>
              <input className="form-control" value={form.first_name} onChange={e => setField('first_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last name</label>
              <input className="form-control" value={form.last_name} onChange={e => setField('last_name', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-control" value={form.role} onChange={e => setField('role', e.target.value)}
              disabled={!isSuperAdmin && form.role === 'super_admin'}>
              {Object.entries(ROLES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {isSuperAdmin && (
            <div className="form-group">
              <label className="form-label">Organization</label>
              <select className="form-control" value={form.org_id} onChange={e => setField('org_id', e.target.value)}>
                <option value="">Select…</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-control" value={form.status} onChange={e => setField('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <ModalActions>
            <button className="btn" onClick={() => { setEditUser(null); setError('') }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveUser} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </ModalActions>
        </Modal>
      )}
    </div>
  )
}
