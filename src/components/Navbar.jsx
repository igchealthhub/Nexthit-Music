import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import './Navbar.css'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [artistOpen, setArtistOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      setUnreadMessages(0)
      return
    }

    let cancelled = false

    async function loadUnreadCounts() {
      const [{ count: notificationsCount, error: notifError }, { count: messageCount, error: messageError }] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('to_user', user.id)
          .eq('read', false),
      ])

      if (cancelled) return
      setUnreadCount(notifError ? 0 : (notificationsCount || 0))
      setUnreadMessages(messageError ? 0 : (messageCount || 0))
    }

    loadUnreadCounts()

    const interval = setInterval(loadUnreadCounts, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.id])

  async function handleSignOut() {
    await signOut()
    navigate('/')
    setOpen(false)
  }

  function close() {
    setOpen(false)
    setArtistOpen(false)
  }

  const isArtist = profile?.role === 'artist'
  const isAdmin = profile?.is_admin === true

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={close}>
        <span className="brand-icon">🎵</span>
        <span className="brand-name">NextHit</span>
      </Link>

      <div className={`navbar-links ${open ? 'open' : ''}`}>
        {/* Public links */}
        <NavLink to="/songs"       onClick={close}>Songs</NavLink>
        <NavLink to="/videos"      onClick={close}>Videos</NavLink>
        <NavLink to="/trending"    onClick={close}>Trending</NavLink>
        <NavLink to="/leaderboard" onClick={close}>Leaderboard</NavLink>
        <NavLink to="/contests"    onClick={close}>Contests</NavLink>
        <NavLink to="/livestreams" onClick={close}>Live</NavLink>

        {user ? (
          <>
            <div className="nav-divider" />

            <NavLink to="/dashboard" onClick={close}>Dashboard</NavLink>

            {/* Artist section */}
            {isArtist && (
              <div className="nav-dropdown-wrap">
                <button
                  className={`nav-dropdown-trigger ${artistOpen ? 'active' : ''}`}
                  onClick={() => setArtistOpen(v => !v)}
                >
                  🎤 Artist <span className="nav-caret">▾</span>
                </button>
                {artistOpen && (
                  <div className="nav-dropdown">
                    <NavLink to="/artist-dashboard" onClick={close}>
                      📊 Artist Dashboard
                    </NavLink>
                    <NavLink to="/upload/song" onClick={close}>
                      🎵 Upload Song
                    </NavLink>
                    <NavLink to="/upload/video" onClick={close}>
                      🎬 Upload Video
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* Admin link */}
            {isAdmin && (
              <NavLink to="/admin" onClick={close} className="nav-admin-link">
                ⚙️ Admin
                {unreadCount > 0 && (
                  <span className="notif-badge" style={{ position: 'static', marginLeft: '0.4rem' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            )}

            <NavLink to="/profile" onClick={close}>Profile</NavLink>

            {/* Messages icon */}
            <Link to="/messages" className="nav-notif-btn" onClick={close} title="Messages">
              💬
              {unreadMessages > 0 && (
                <span className="notif-badge">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
              )}
            </Link>

            {/* Notification bell */}
            <Link to="/notifications" className="nav-notif-btn" onClick={close} title="Notifications">
              🔔
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </Link>

            <button className="btn btn-outline btn-sm" onClick={handleSignOut}>Log out</button>
          </>
        ) : (
          <>
            <div className="nav-divider" />
            <NavLink to="/login" onClick={close}>Log in</NavLink>
            <Link to="/signup" className="btn btn-primary btn-sm" onClick={close}>Sign up</Link>
          </>
        )}
      </div>

      <button
        className={`navbar-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      {open && <div className="navbar-overlay" onClick={close} />}
    </nav>
  )
}
