import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import SongsPage from './pages/SongsPage'
import VideosPage from './pages/VideosPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ContestsPage from './pages/ContestsPage'
import UploadSongPage from './pages/UploadSongPage'
import UploadSongSuccessPage from './pages/UploadSongSuccessPage'
import UploadVideoPage from './pages/UploadVideoPage'
import ArtistDashboardPage from './pages/ArtistDashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import ContestDetailPage from './pages/ContestDetailPage'
import NotificationsPage from './pages/NotificationsPage'
import ArtistProfilePage from './pages/ArtistProfilePage'
import TrendingPage from './pages/TrendingPage'
import LivestreamsPage from './pages/LivestreamsPage'
import MessagesPage from './pages/MessagesPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ArtistAgreementPage from './pages/ArtistAgreementPage'

import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-layout">
          <Navbar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/songs" element={<SongsPage />} />
              <Route path="/videos" element={<VideosPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/contests" element={<ContestsPage />} />
              <Route path="/dashboard" element={
                <ProtectedRoute><DashboardPage /></ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute><ProfilePage /></ProtectedRoute>
              } />
              <Route path="/upload/song" element={
                <ProtectedRoute roles={['artist']}><UploadSongPage /></ProtectedRoute>
              } />
              <Route path="/upload/video" element={
                <ProtectedRoute roles={['artist']}><UploadVideoPage /></ProtectedRoute>
              } />
              <Route path="/artist-dashboard" element={
                <ProtectedRoute roles={['artist']}><ArtistDashboardPage /></ProtectedRoute>
              } />
              <Route path="/upload/song/success" element={
                <ProtectedRoute roles={['artist']}><UploadSongSuccessPage /></ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute adminOnly><AdminDashboardPage /></ProtectedRoute>
              } />
              <Route path="/contests/:id" element={<ContestDetailPage />} />
              <Route path="/contest/:id" element={<ContestDetailPage />} />
              <Route path="/artist/:id" element={<ArtistProfilePage />} />
              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/livestreams" element={<LivestreamsPage />} />
              <Route path="/playlist/:id" element={<PlaylistDetailPage />} />
              <Route path="/notifications" element={
                <ProtectedRoute><NotificationsPage /></ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute><MessagesPage /></ProtectedRoute>
              } />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/artist-agreement" element={<ArtistAgreementPage />} />
            </Routes>
          </main>
          <footer className="app-footer">
            <div className="app-footer-inner">
              <span>NextHit Music</span>
              <div className="app-footer-links">
                <Link to="/terms">Terms of Service</Link>
                <Link to="/privacy">Privacy Policy</Link>
                <Link to="/artist-agreement">Artist Agreement</Link>
              </div>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
