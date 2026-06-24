import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LeaderboardPage() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('songs')

  useEffect(() => {
    supabase
      .from('songs')
      .select('*')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .limit(20)
      .then(({ data }) => { setSongs(data || []); setLoading(false) })
  }, [])

  const rankLabel = i => {
    if (i === 0) return { label: '🥇', cls: 'top-1' }
    if (i === 1) return { label: '🥈', cls: 'top-2' }
    if (i === 2) return { label: '🥉', cls: 'top-3' }
    return { label: `#${i + 1}`, cls: '' }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏆 Leaderboard</h1>
        <p>Top tracks ranked by total plays</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn btn-sm ${tab === 'songs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('songs')}
        >🎵 Songs</button>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : songs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h3>No rankings yet</h3>
          <p>Songs will appear here once they get plays.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {songs.map((song, i) => {
            const { label, cls } = rankLabel(i)
            return (
              <div key={song.id} className="leaderboard-row">
                <div className={`lb-rank ${cls}`}>{label}</div>
                <div className="media-card-thumb" style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', fontSize: '1.25rem', overflow: 'hidden' }}>
                  {song.cover_url ? <img src={song.cover_url} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                </div>
                <div className="lb-info">
                  <div className="lb-title">{song.title}</div>
                  <div className="lb-sub">{new Date(song.created_at).toLocaleDateString()}</div>
                </div>
                <div className="lb-stat">🎧 {song.play_count ?? 0}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
