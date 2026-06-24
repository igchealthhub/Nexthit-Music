import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ArtistDashboardPage() {
  const { user, profile } = useAuth()
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, v] = await Promise.all([
        supabase.from('songs').select('*').eq('artist_id', user.id).order('created_at', { ascending: false }),
        supabase.from('videos').select('*').eq('artist_id', user.id).order('created_at', { ascending: false }),
      ])
      setSongs(s.data || [])
      setVideos(v.data || [])
      setLoading(false)
    }
    load()
  }, [user.id])

  async function deleteItem(table, id, setState) {
    if (!confirm('Delete this item?')) return
    await supabase.from(table).delete().eq('id', id)
    setState(prev => prev.filter(x => x.id !== id))
  }

  const totalPlays = songs.reduce((sum, s) => sum + (s.play_count || 0), 0)

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Artist Hub</h1>
          <p>Manage your music and track performance</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/upload/song" className="btn btn-primary btn-sm">+ Upload Song</Link>
          <Link to="/upload/video" className="btn btn-outline btn-sm">+ Upload Video</Link>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{songs.length}</div>
              <div className="stat-label">Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{videos.length}</div>
              <div className="stat-label">Videos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalPlays.toLocaleString()}</div>
              <div className="stat-label">Total Plays</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{songs.filter(s => s.status === 'published').length}</div>
              <div className="stat-label">Published</div>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>🎵 Your Songs</h2>
            </div>
            {songs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎵</div>
                <h3>No songs yet</h3>
                <Link to="/upload/song" className="btn btn-primary" style={{ marginTop: '1rem' }}>Upload your first song</Link>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Plays</th>
                        <th>Uploaded</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {songs.map(s => (
                        <tr key={s.id}>
                          <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{s.title}</td>
                          <td><span className={`badge ${s.status === 'published' ? 'badge-active' : 'badge-pending'}`}>{s.status}</span></td>
                          <td>🎧 {s.play_count ?? 0}</td>
                          <td>{new Date(s.created_at).toLocaleDateString()}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                              onClick={() => deleteItem('songs', s.id, setSongs)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-header">
              <h2>🎬 Your Videos</h2>
            </div>
            {videos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎬</div>
                <h3>No videos yet</h3>
                <Link to="/upload/video" className="btn btn-primary" style={{ marginTop: '1rem' }}>Upload your first video</Link>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Uploaded</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {videos.map(v => (
                        <tr key={v.id}>
                          <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{v.title}</td>
                          <td><span className={`badge ${v.status === 'published' ? 'badge-active' : 'badge-pending'}`}>{v.status}</span></td>
                          <td>{new Date(v.created_at).toLocaleDateString()}</td>
                          <td>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                              onClick={() => deleteItem('videos', v.id, setVideos)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
