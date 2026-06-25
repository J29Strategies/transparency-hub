import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { timeAgo } from '../lib/helpers'
import Spinner from '../components/Spinner'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchNotifications() }, [])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x))
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    setNotifications(n => n.map(x => ({ ...x, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={32} /></div>

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left"><div className="topbar-title">Notifications</div></div>
        <div className="topbar-actions">
          {unreadCount > 0 && (
            <button className="btn btn-sm" onClick={markAllRead}>Mark all read</button>
          )}
        </div>
      </div>
      <div className="page">
        <div className="card">
          {notifications.length === 0 && (
            <div className="empty"><i className="ti ti-bell" /><p>No notifications yet</p></div>
          )}
          {notifications.map(n => (
            <div key={n.id} className="notif-item" onClick={() => !n.read && markRead(n.id)}>
              <div className={`notif-dot${n.read ? ' read' : ''}`} />
              <div>
                <div className="notif-text" style={{ fontWeight: n.read ? 400 : 600 }}>{n.text}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
