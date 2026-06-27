import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// adminOnly  — requires profile.is_admin === true
// roles      — requires profile.role to be in the list; is_admin bypasses this too
export default function ProtectedRoute({ children, roles, adminOnly }) {
  const { user, profile, loading } = useAuth()

  if (loading || (user && !profile)) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (profile) {
    if (adminOnly && !profile.is_admin) return <Navigate to="/dashboard" replace />
    if (roles && !roles.includes(profile.role) && !profile.is_admin) return <Navigate to="/dashboard" replace />
  }

  return children
}
