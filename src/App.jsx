import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import UploadVideoPage from './pages/UploadVideoPage'
import ArtistDashboardPage from './pages/ArtistDashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'

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
              <Route path="/admin" element={
                <ProtectedRoute adminOnly><AdminDashboardPage /></ProtectedRoute>
              } />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
