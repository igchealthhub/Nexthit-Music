import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SongsPage() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(null)
  const [audio, setAudio] = useState(null)

  useEffect(() => {
    supabase
      .from('songs')
      .select('*')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .then(({ data }) => { setSongs(data || []); setLoading(false) })
  }, [])

  function togglePlay(song) {
    if (playing?.id === song.id) {
      audio?.pause()
      setPlaying(null)
      setAudio(null)
      return
    }
    audio?.pause()
    if (song.audio_url) {
      const a = new Audio(song.audio_url)
      a.play().catch(() => {})
      setAudio(a)
      setPlaying(song)
      // increment play count optimistically
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, play_count: (s.play_count || 0) + 1 } : s))
      supabase.from('songs').update({ play_count: (song.play_count || 0) + 1 }).eq('id', song.id)
    }
  }

  useEffect(() => () => audio?.pause(), [audio])

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎵 Songs</h1>
        <p>Stream the latest tracks from independent artists</p>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : songs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <h3>No songs yet</h3>
          <p>Artists haven't uploaded any songs. Check back soon!</p>
        </div>
      ) : (
        <div className="grid-3">
          {songs.map(song => (
            <div
              key={song.id}
              className="media-card"
              onClick={() => togglePlay(song)}
              style={{ cursor: song.audio_url ? 'pointer' : 'default' }}
            >
              <div className="media-card-thumb" style={{ position: 'relative' }}>
                {song.cover_url ? <img src={song.cover_url} alt={song.title} /> : '🎵'}
                {song.audio_url && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)',
                    opacity: playing?.id === song.id ? 1 : 0,
                    transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = playing?.id === song.id ? 1 : 0}
                  >
                    <span style={{ fontSize: '2.5rem' }}>
                      {playing?.id === song.id ? '⏸' : '▶️'}
                    </span>
                  </div>
                )}
              </div>
              <div className="media-card-body">
                <div className="media-card-title">{song.title}</div>
                <div className="media-card-meta">
                  <span>🎧 {song.play_count ?? 0}</span>
                  {song.description && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.description}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
