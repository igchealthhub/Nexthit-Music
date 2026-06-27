import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// adminOnly  — requires profile.is_admin === true
// roles      — requires profile.role to be in the list; is_admin bypasses this too
export default function ProtectedRoute({ children, roles, adminOnly }) {
  const { user, profile, loading, authError, refreshProfile } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (authError && !profile) {
    return (
      <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Unable to load your profile:</strong> {authError}
        </div>
        <button className="btn btn-primary" onClick={refreshProfile}>
          Retry profile load
        </button>
        <button className="btn btn-outline" style={{ marginLeft: '0.75rem' }} onClick={() => navigate('/login')}>
          Sign in again
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="alert alert-warning">
          Profile not found. Please refresh or contact support.
        </div>
        <button className="btn btn-primary" onClick={refreshProfile}>
          Retry profile load
        </button>
      </div>
    )
  }

  if (adminOnly && !profile.is_admin) return <Navigate to="/dashboard" replace />
  if (roles && !roles.includes(profile.role) && !profile.is_admin) return <Navigate to="/dashboard" replace />

  return children
}
