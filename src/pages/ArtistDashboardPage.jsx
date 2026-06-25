import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const STATUS_STYLE = {
  pending: { badge: 'badge-pending', label: '⏳ Pending review' },
  approved: { badge: 'badge-active', label: '✅ Live' },
  rejected: { badge: 'badge-admin', label: '❌ Rejected' },
  draft: { badge: 'badge-fan', label: 'Draft' },
}

export default function ArtistDashboardPage() {
  const { user } = useAuth()
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [likeCounts, setLikeCounts] = useState({})
  const [ratingAvgs, setRatingAvgs] = useState({})
  const [ratingCounts, setRatingCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('songs')

  useEffect(() => {
    async function load() {
      const [s, v] = await Promise.all([
        supabase.from('songs').select('*, genres(name)').eq('artist_id', user.id).order('created_at', { ascending: false }),
        supabase.from('videos').select('*').eq('artist_id', user.id).order('created_at', { ascending: false }),
      ])
      const songData = s.data || []
      setSongs(songData)
      setVideos(v.data || [])

      if (songData.length) {
        const ids = songData.map(s => s.id)

        const [likes, ratings] = await Promise.all([
          supabase.from('likes').select('song_id').in('song_id', ids),
          supabase.from('ratings').select('song_id, rating').in('song_id', ids),
        ])

        const lc = {}
        likes.data?.forEach(l => { lc[l.song_id] = (lc[l.song_id] || 0) + 1 })
        setLikeCounts(lc)

        const avgs = {}, counts = {}
        ratings.data?.forEach(r => {
          avgs[r.song_id] = (avgs[r.song_id] || 0) + r.rating
          counts[r.song_id] = (counts[r.song_id] || 0) + 1
        })
        Object.keys(avgs).forEach(id => { avgs[id] = avgs[id] / counts[id] })
        setRatingAvgs(avgs)
        setRatingCounts(counts)
      }

      setLoading(false)
    }
    load()
  }, [user.id])

  async function deleteSong(id) {
    if (!confirm('Delete this song? This cannot be undone.')) return
    await supabase.from('songs').delete().eq('id', id)
    setSongs(prev => prev.filter(s => s.id !== id))
  }

  async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return
    await supabase.from('videos').delete().eq('id', id)
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  const totalPlays = songs.reduce((sum, s) => sum + (s.play_count || 0), 0)
  const totalLikes = Object.values(likeCounts).reduce((a, b) => a + b, 0)
  const approvedCount = songs.filter(s => s.status === 'approved').length
  const pendingCount = songs.filter(s => s.status === 'pending').length

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🎤 Artist Hub</h1>
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
              <div className="stat-label">Total Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{approvedCount}</div>
              <div className="stat-label">Live</div>
            </div>
            <div className="stat-card" style={{ borderColor: pendingCount ? 'var(--warning)' : 'var(--border)' }}>
              <div className="stat-value" style={{ color: pendingCount ? 'var(--warning)' : 'var(--text-h)' }}>{pendingCount}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalPlays.toLocaleString()}</div>
              <div className="stat-label">Total Plays</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#f87171' }}>{totalLikes}</div>
              <div className="stat-label">Total Likes</div>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
              ⏳ You have {pendingCount} song{pendingCount > 1 ? 's' : ''} pending review. They'll go live once approved by an admin.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button className={`btn btn-sm ${tab === 'songs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('songs')}>
              🎵 Songs ({songs.length})
            </button>
            <button className={`btn btn-sm ${tab === 'videos' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('videos')}>
              🎬 Videos ({videos.length})
            </button>
          </div>

          {tab === 'songs' && (
            songs.length === 0 ? (
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
                        <th>Song</th>
                        <th>Status</th>
                        <th>Plays</th>
                        <th>Likes</th>
                        <th>Rating</th>
                        <th>Price</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {songs.map(s => {
                        const st = STATUS_STYLE[s.status] || STATUS_STYLE.draft
                        const avgR = ratingAvgs[s.id]
                        return (
                          <tr key={s.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                                  {s.cover_url ? <img src={s.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.9rem' }}>{s.title}</div>
                                  {s.genres?.name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.genres.name}</div>}
                                </div>
                              </div>
                            </td>
                            <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                            <td>🎧 {(s.play_count || 0).toLocaleString()}</td>
                            <td>❤️ {likeCounts[s.id] || 0}</td>
                            <td>
                              {avgR ? (
                                <span title={`${ratingCounts[s.id]} ratings`}>
                                  ⭐ {avgR.toFixed(1)}
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>({ratingCounts[s.id]})</span>
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td>{s.price > 0 ? `$${Number(s.price).toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>Free</span>}</td>
                            <td>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => deleteSong(s.id)}>Delete</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {tab === 'videos' && (
            videos.length === 0 ? (
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
                      <tr><th>Title</th><th>Status</th><th>Uploaded</th><th></th></tr>
                    </thead>
                    <tbody>
                      {videos.map(v => {
                        const st = STATUS_STYLE[v.status] || STATUS_STYLE.draft
                        return (
                          <tr key={v.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>{v.title}</td>
                            <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                            <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => deleteVideo(v.id)}>Delete</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
