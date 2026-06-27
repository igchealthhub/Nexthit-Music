import { useAuth } from '../contexts/AuthContext'
import FanDashboardPage from './FanDashboardPage'
import ArtistDashboardPage from './ArtistDashboardPage'
import AdminDashboardPage from './AdminDashboardPage'

export default function DashboardPage() {
  const { user, profile, loading, authError, refreshProfile } = useAuth()

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (authError) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Unable to load your profile:</strong> {authError}
        </div>
        <button className="btn btn-primary" onClick={refreshProfile}>Retry profile load</button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          Profile not available. Please refresh the page.
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Debug profile</h2>
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
          <div><strong>Email:</strong> {user?.email || 'Unknown'}</div>
          <div><strong>profile.role:</strong> {profile.role || 'unknown'}</div>
          <div><strong>profile.is_admin:</strong> {String(profile.is_admin ?? false)}</div>
        </div>
      </div>
      {profile.is_admin ? <AdminDashboardPage /> : profile.role === 'artist' ? <ArtistDashboardPage /> : <FanDashboardPage />}
    </div>
  )
}
