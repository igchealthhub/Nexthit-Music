import { useAuth } from '../contexts/AuthContext'
import FanDashboardPage from './FanDashboardPage'
import ArtistDashboardPage from './ArtistDashboardPage'
import AdminDashboardPage from './AdminDashboardPage'

export default function DashboardPage() {
  const { profile, loading } = useAuth()

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (profile?.is_admin) return <AdminDashboardPage />
  if (profile?.role === 'artist') return <ArtistDashboardPage />
  return <FanDashboardPage />
}
