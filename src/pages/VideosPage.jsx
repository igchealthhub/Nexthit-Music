import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function VideosPage() {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setVideos(data || []); setLoading(false) })
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎬 Videos</h1>
        <p>Watch music videos from artists on NextHit</p>
      </div>

      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: '1.5rem',
          }}
          onClick={() => setSelected(null)}
        >
          <div style={{ maxWidth: 800, width: '100%' }} onClick={e => e.stopPropagation()}>
            <video
              src={selected.video_url}
              controls
              autoPlay
              style={{ width: '100%', borderRadius: 12, background: '#000' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <h2 style={{ color: '#fff' }}>{selected.title}</h2>
              <button className="btn btn-ghost" style={{ color: '#fff' }} onClick={() => setSelected(null)}>✕ Close</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : videos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎬</div>
          <h3>No videos yet</h3>
          <p>Artists haven't uploaded any videos. Check back soon!</p>
        </div>
      ) : (
        <div className="grid-3">
          {videos.map(v => (
            <div key={v.id} className="media-card" onClick={() => v.video_url && setSelected(v)}>
              <div className="media-card-thumb">
                {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} /> : '🎬'}
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem',
                }}>
                  {v.video_url && '▶️'}
                </div>
              </div>
              <div className="media-card-body">
                <div className="media-card-title">{v.title}</div>
                {v.description && (
                  <div className="media-card-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
