import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, v, c] = await Promise.all([
        supabase.from('songs').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(6),
        supabase.from('videos').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(3),
        supabase.from('contests').select('*').eq('status', 'active').limit(3),
      ])
      setSongs(s.data || [])
      setVideos(v.data || [])
      setContests(c.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'there'
  const roleBadge = profile?.role ? <span className={`badge badge-${profile.role}`}>{profile.role}</span> : null

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Hey, {displayName} 👋</h1>
          <div style={{ marginTop: '0.375rem' }}>{roleBadge}</div>
        </div>
        {profile?.role === 'artist' && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/upload/song" className="btn btn-outline btn-sm">+ Upload Song</Link>
            <Link to="/upload/video" className="btn btn-outline btn-sm">+ Upload Video</Link>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          {contests.length > 0 && (
            <div className="section">
              <div className="section-header">
                <h2>🏆 Active Contests</h2>
                <Link to="/contests" className="btn btn-ghost btn-sm">View all →</Link>
              </div>
              <div className="grid-3">
                {contests.map(c => (
                  <div key={c.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1rem' }}>{c.title}</h3>
                      <span className="badge badge-active">{c.status}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.5 }}>{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-header">
              <h2>🎵 New Songs</h2>
              <Link to="/songs" className="btn btn-ghost btn-sm">Browse all →</Link>
            </div>
            {songs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎵</div>
                <h3>No songs yet</h3>
                <p>Check back soon — music is on its way.</p>
              </div>
            ) : (
              <div className="grid-3">
                {songs.map(s => (
                  <div key={s.id} className="media-card">
                    <div className="media-card-thumb">
                      {s.cover_url ? <img src={s.cover_url} alt={s.title} /> : '🎵'}
                    </div>
                    <div className="media-card-body">
                      <div className="media-card-title">{s.title}</div>
                      <div className="media-card-meta">
                        <span>🎧 {s.play_count ?? 0} plays</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-header">
              <h2>🎬 New Videos</h2>
              <Link to="/videos" className="btn btn-ghost btn-sm">Browse all →</Link>
            </div>
            {videos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎬</div>
                <h3>No videos yet</h3>
                <p>Videos from artists will appear here.</p>
              </div>
            ) : (
              <div className="grid-3">
                {videos.map(v => (
                  <div key={v.id} className="media-card">
                    <div className="media-card-thumb">
                      {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} /> : '🎬'}
                    </div>
                    <div className="media-card-body">
                      <div className="media-card-title">{v.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
