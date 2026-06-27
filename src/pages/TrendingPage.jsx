import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TrendingPage() {
  const [trending, setTrending] = useState([])
  const [newReleases, setNewReleases] = useState([])
  const [topByGenre, setTopByGenre] = useState([])
  const [playMap, setPlayMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const weekAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [playsRes, newRes, genreSongsRes] = await Promise.all([
      supabase.from('song_plays').select('song_id').gte('played_at', weekAgo).limit(2000),
      supabase.from('songs')
        .select('id, title, cover_url, play_count, created_at, genres(name)')
        .eq('status', 'approved')
        .gte('created_at', monthAgo)
        .order('play_count', { ascending: false })
        .limit(8),
      supabase.from('songs')
        .select('id, title, cover_url, play_count, genre_id, genres(id, name)')
        .eq('status', 'approved')
        .order('play_count', { ascending: false })
        .limit(200),
    ])

    // Trending: count plays from last 7 days
    const pm = {}
    playsRes.data?.forEach(p => { pm[p.song_id] = (pm[p.song_id] || 0) + 1 })
    setPlayMap(pm)

    const topIds = Object.entries(pm)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => id)

    if (topIds.length) {
      const trendRes = await supabase.from('songs')
        .select('id, title, cover_url, play_count, genres(name)')
        .in('id', topIds)
        .eq('status', 'approved')
      setTrending(
        (trendRes.data || []).sort((a, b) => (pm[b.id] || 0) - (pm[a.id] || 0))
      )
    } else {
      // Fallback: top songs by all-time plays
      const fallback = await supabase.from('songs')
        .select('id, title, cover_url, play_count, genres(name)')
        .eq('status', 'approved')
        .order('play_count', { ascending: false })
        .limit(10)
      setTrending(fallback.data || [])
    }

    setNewReleases(newRes.data || [])

    // Top song per genre
    const genreMap = {}
    ;(genreSongsRes.data || []).forEach(s => {
      if (s.genres && !genreMap[s.genre_id]) {
        genreMap[s.genre_id] = { genre: s.genres, song: s }
      }
    })
    setTopByGenre(Object.values(genreMap).slice(0, 8))

    setLoading(false)
  }

  const rankLabel = i => {
    if (i === 0) return { label: '🥇', cls: 'top-1' }
    if (i === 1) return { label: '🥈', cls: 'top-2' }
    if (i === 2) return { label: '🥉', cls: 'top-3' }
    return { label: `#${i + 1}`, cls: '' }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>📈 Trending</h1>
        <p>What's hot right now — updated in real time</p>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          {/* Trending This Week */}
          <div className="section">
            <div className="section-header">
              <h2>🔥 Trending This Week</h2>
              <Link to="/leaderboard" className="btn btn-ghost btn-sm">Full leaderboard →</Link>
            </div>
            {trending.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-icon">🔥</div>
                <h3>No plays yet this week</h3>
                <p>Start listening to push songs up the charts.</p>
                <Link to="/songs" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Browse Songs</Link>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {trending.map((song, i) => {
                  const { label, cls } = rankLabel(i)
                  const weekPlays = playMap[song.id] || 0
                  return (
                    <div key={song.id} className="leaderboard-row">
                      <div className={`lb-rank ${cls}`}>{label}</div>
                      <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', fontSize: '1.25rem', overflow: 'hidden' }}>
                        {song.cover_url ? <img src={song.cover_url} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                      </div>
                      <div className="lb-info">
                        <div className="lb-title">{song.title}</div>
                        <div className="lb-sub">{song.genres?.name || 'Music'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem', flexShrink: 0 }}>
                        <div className="lb-stat" style={{ color: '#f97316', fontWeight: 700 }}>🔥 {weekPlays} this week</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🎧 {(song.play_count || 0).toLocaleString()} total</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Hot New Releases */}
          <div className="section">
            <div className="section-header">
              <h2>✨ Hot New Releases</h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Last 30 days</span>
            </div>
            {newReleases.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-icon">✨</div>
                <h3>No new releases this month</h3>
              </div>
            ) : (
              <div className="grid-4">
                {newReleases.map(s => (
                  <div key={s.id} className="media-card">
                    <div className="media-card-thumb">
                      {s.cover_url ? <img src={s.cover_url} alt={s.title} /> : '🎵'}
                    </div>
                    <div className="media-card-body">
                      <div className="media-card-title">{s.title}</div>
                      <div className="media-card-meta">
                        {s.genres?.name && <span className="genre-tag" style={{ fontSize: '0.7rem' }}>{s.genres.name}</span>}
                        <span>🎧 {(s.play_count || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top by Genre */}
          {topByGenre.length > 0 && (
            <div className="section">
              <div className="section-header">
                <h2>🎸 Top by Genre</h2>
              </div>
              <div className="grid-4">
                {topByGenre.map(({ genre, song }) => (
                  <div key={genre.id} className="card card-sm" style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>
                      {genre.name}
                    </div>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
                        {song.cover_url ? <img src={song.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🎧 {(song.play_count || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/songs" className="btn btn-primary">🎵 Browse All Songs</Link>
          </div>
        </>
      )}
    </div>
  )
}
