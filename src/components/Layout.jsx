import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { initials } from '../lib/helpers'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Layout() {
  const { profile, signOut, isAdvocate, isAdmin, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [openCount, setOpenCount] = useState(0)

  useEffect(() => {
    fetchCounts()
    // Poll every 60 seconds for new notifications
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchCounts() {
    const [{ count: unread }, { count: open }] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false),
      supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ])
    setUnreadCount(unread ?? 0)
    setOpenCount(open ?? 0)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navItem = (to, icon, label, badge) => (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <i className={`ti ti-${icon}`} />
      {label}
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </NavLink>
  )

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark"><span>TH</span></div>
          <div className="brand-title">Transparency Hub</div>
          <div className="brand-sub">FC Collaborative · Beta</div>
        </div>

        <nav className="nav">
          {navItem('/', 'layout-dashboard', 'Dashboard')}
          {isAdvocate
            ? navItem('/youth', 'users', 'My Youth')
            : navItem('/youth', 'users', 'Young Adults')}
          {!isAdvocate && navItem('/agencies', 'building-community', 'Agencies')}
          {navItem('/referrals', 'arrows-exchange', 'Referrals', openCount)}
          {navItem('/notifications', 'bell', 'Notifications', unreadCount)}
          {isAdmin && <hr style={{ margin: '4px 16px', border: 'none', borderTop: '1px solid #ebebea' }} />}
          {isSuperAdmin && navItem('/admin', 'settings', 'Admin')}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">
            {initials(profile?.first_name, profile?.last_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{profile?.first_name} {profile?.last_name}</div>
            <div className="user-role">{profile?.org?.name ?? '—'}</div>
          </div>
          <button
            onClick={handleSignOut}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
            title="Sign out"
          >
            <i className="ti ti-logout" style={{ fontSize: 16 }} />
          </button>
        </div>
      </aside>

      <div className="main">
        <Outlet context={{ refreshCounts: fetchCounts }} />
      </div>
    </div>
  )
}
