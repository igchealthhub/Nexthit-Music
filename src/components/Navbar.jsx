import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [artistOpen, setArtistOpen] = useState(false)

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
  const isAdmin  = profile?.is_admin === true

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
        <NavLink to="/leaderboard" onClick={close}>Leaderboard</NavLink>
        <NavLink to="/contests"    onClick={close}>Contests</NavLink>

        {user ? (
          <>
            <div className="nav-divider" />

            <NavLink to="/dashboard" onClick={close}>Dashboard</NavLink>

            {/* Artist section */}
            {(isArtist || isAdmin) && (
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
              </NavLink>
            )}

            <NavLink to="/profile" onClick={close}>Profile</NavLink>
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
