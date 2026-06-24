import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ songs: 0, videos: 0, contests: 0 })
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('songs')

  useEffect(() => {
    async function load() {
      const [s, v, c] = await Promise.all([
        supabase.from('songs').select('*').order('created_at', { ascending: false }),
        supabase.from('videos').select('*').order('created_at', { ascending: false }),
        supabase.from('contests').select('*').order('created_at', { ascending: false }),
      ])
      setSongs(s.data || [])
      setVideos(v.data || [])
      setStats({ songs: s.data?.length || 0, videos: v.data?.length || 0, contests: c.data?.length || 0 })
      setLoading(false)
    }
    load()
  }, [])

  async function updateStatus(table, id, status, setState) {
    await supabase.from(table).update({ status }).eq('id', id)
    setState(prev => prev.map(x => x.id === id ? { ...x, status } : x))
  }

  async function deleteItem(table, id, setState) {
    if (!confirm('Permanently delete this item?')) return
    await supabase.from(table).delete().eq('id', id)
    setState(prev => prev.filter(x => x.id !== id))
  }

  const items = tab === 'songs' ? songs : videos
  const setState = tab === 'songs' ? setSongs : setVideos
  const table = tab === 'songs' ? 'songs' : 'videos'

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚙️ Admin Dashboard</h1>
        <p>Moderate content and manage the platform</p>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{stats.songs}</div>
              <div className="stat-label">Total Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.videos}</div>
              <div className="stat-label">Total Videos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.contests}</div>
              <div className="stat-label">Contests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {songs.filter(s => s.status === 'published').length + videos.filter(v => v.status === 'published').length}
              </div>
              <div className="stat-label">Published</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button className={`btn btn-sm ${tab === 'songs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('songs')}>🎵 Songs ({songs.length})</button>
            <button className={`btn btn-sm ${tab === 'videos' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('videos')}>🎬 Videos ({videos.length})</button>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>No {tab} yet</h3>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      {tab === 'songs' && <th>Plays</th>}
                      <th>Status</th>
                      <th>Uploaded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td style={{ color: 'var(--text-h)', fontWeight: 500 }}>{item.title}</td>
                        {tab === 'songs' && <td>{item.play_count ?? 0}</td>}
                        <td>
                          <span className={`badge ${item.status === 'published' ? 'badge-active' : 'badge-pending'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {item.status !== 'published' && (
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }}
                                onClick={() => updateStatus(table, item.id, 'published', setState)}>
                                Publish
                              </button>
                            )}
                            {item.status === 'published' && (
                              <button className="btn btn-ghost btn-sm"
                                onClick={() => updateStatus(table, item.id, 'draft', setState)}>
                                Unpublish
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                              onClick={() => deleteItem(table, item.id, setState)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
