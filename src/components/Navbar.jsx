import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
    setOpen(false)
  }

  function close() { setOpen(false) }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={close}>
        <span className="brand-icon">🎵</span>
        <span className="brand-name">NextHit</span>
      </Link>

      <div className={`navbar-links ${open ? 'open' : ''}`}>
        <NavLink to="/songs" onClick={close}>Songs</NavLink>
        <NavLink to="/videos" onClick={close}>Videos</NavLink>
        <NavLink to="/leaderboard" onClick={close}>Leaderboard</NavLink>
        <NavLink to="/contests" onClick={close}>Contests</NavLink>

        {user ? (
          <>
            <div className="nav-divider" />
            <NavLink to="/dashboard" onClick={close}>Dashboard</NavLink>
            {profile?.role === 'artist' && (
              <NavLink to="/artist-dashboard" onClick={close}>Artist Hub</NavLink>
            )}
            {profile?.role === 'admin' && (
              <NavLink to="/admin" onClick={close}>Admin</NavLink>
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
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      {open && <div className="navbar-overlay" onClick={close} />}
    </nav>
  )
}
