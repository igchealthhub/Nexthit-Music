import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const TYPE_ICONS = {
  song_approved:  '✅',
  song_rejected:  '❌',
  song_purchased: '💰',
  new_follower:   '👥',
  new_comment:    '💬',
  general:        '🔔',
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => { load() }, [user?.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) return
    setMarking(true)
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setMarking(false)
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🔔 Notifications</h1>
          {unreadCount > 0 && (
            <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={marking}>
            {marking ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h3>No notifications yet</h3>
          <p>You'll be notified when songs are approved, someone follows you, and more.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {notifications.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.875rem',
                padding: '1rem 1.25rem',
                borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                background: n.read ? 'transparent' : 'rgba(168,85,247,0.04)',
                transition: 'background 0.15s',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: n.read ? 'var(--surface-2)' : 'var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.125rem', flexShrink: 0,
              }}>
                {TYPE_ICONS[n.type] || '🔔'}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.read ? 500 : 700, color: 'var(--text-h)', fontSize: '0.9rem' }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginTop: '0.2rem', lineHeight: 1.5 }}>
                    {n.body}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</span>
                  {n.link && (
                    <Link
                      to={n.link}
                      style={{ fontSize: '0.75rem', color: 'var(--accent)' }}
                      onClick={() => !n.read && markRead(n.id)}
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flexShrink: 0 }}>
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem', padding: '0.25rem 0', whiteSpace: 'nowrap' }}
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => deleteNotif(n.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.25rem 0' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
