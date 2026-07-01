import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getSongCoverImage, withSongCoverUrl } from '../lib/songCovers'

export default function ArtistProfilePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [artist, setArtist] = useState(null)
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [followerCount, setFollowerCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const isOwnProfile = user?.id === id

  useEffect(() => { load() }, [id, user?.id])

  async function load() {
    setLoading(true)

    const [profileRes, songsRes, videosRes, followsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('songs').select('*, genres(name)').eq('artist_id', id).eq('status', 'approved').order('play_count', { ascending: false }).limit(20),
      supabase.from('videos').select('*').eq('artist_id', id).eq('status', 'approved').order('created_at', { ascending: false }).limit(10),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('artist_id', id),
    ])

    if (!profileRes.data) { setNotFound(true); setLoading(false); return }

    setArtist(profileRes.data)
    setSongs((songsRes.data || []).map(withSongCoverUrl))
    setVideos(videosRes.data || [])
    setFollowerCount(followsRes.count || 0)

    if (user && !isOwnProfile) {
      const myFollowRes = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('artist_id', id).maybeSingle()
      setIsFollowing(!!myFollowRes.data)
    }

    setLoading(false)
  }

  async function toggleFollow() {
    if (!user) { navigate('/login'); return }
    setToggling(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('artist_id', id)
      setIsFollowing(false)
      setFollowerCount(prev => Math.max(0, prev - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, artist_id: id })
      setIsFollowing(true)
      setFollowerCount(prev => prev + 1)
    }
    setToggling(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (notFound) return (
    <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
      <h1>Artist Not Found</h1>
      <p style={{ margin: '1rem 0 2rem', color: 'var(--text)' }}>This profile doesn't exist or has been removed.</p>
      <Link to="/songs" className="btn btn-primary">Browse Songs</Link>
    </div>
  )

  const links = artist.social_links || {}
  const totalPlays = songs.reduce((sum, s) => sum + (s.play_count || 0), 0)

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      {/* Profile header */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', flexShrink: 0, overflow: 'hidden',
            border: '3px solid var(--border)',
          }}>
            {artist.avatar_url
              ? <img src={artist.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '🎤'}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {artist.display_name || artist.email?.split('@')[0]}
                  {artist.verified && (
                    <span title="Verified Artist" style={{ fontSize: '1rem', color: '#60a5fa', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>✓ Verified</span>
                  )}
                </h1>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge badge-${artist.role || 'fan'}`}>{artist.role || 'fan'}</span>
                  {artist.is_admin && <span className="badge badge-admin">Admin</span>}
                </div>
              </div>

              {!isOwnProfile && (
                <button
                  className={`btn ${isFollowing ? 'btn-outline' : 'btn-primary'}`}
                  onClick={toggleFollow}
                  disabled={toggling}
                >
                  {toggling ? '…' : isFollowing ? 'Following ✓' : '+ Follow'}
                </button>
              )}
              {isOwnProfile && (
                <Link to="/profile" className="btn btn-outline btn-sm">Edit Profile</Link>
              )}
            </div>

            {/* Bio */}
            {artist.bio && (
              <p style={{ marginTop: '0.875rem', color: 'var(--text)', lineHeight: 1.6, maxWidth: 540 }}>{artist.bio}</p>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: '1.125rem' }}>{songs.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Songs</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: '1.125rem' }}>{videos.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Videos</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.125rem' }}>{followerCount}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Followers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: '1.125rem' }}>{totalPlays.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Plays</div>
              </div>
            </div>

            {/* Social links */}
            {(links.instagram || links.twitter || links.spotify || links.website) && (
              <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {links.instagram && (
                  <a href={links.instagram} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ fontSize: '0.8125rem' }}>
                    📸 Instagram
                  </a>
                )}
                {links.twitter && (
                  <a href={links.twitter} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ fontSize: '0.8125rem' }}>
                    🐦 X / Twitter
                  </a>
                )}
                {links.spotify && (
                  <a href={links.spotify} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ fontSize: '0.8125rem' }}>
                    🎧 Spotify
                  </a>
                )}
                {links.website && (
                  <a href={links.website} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ fontSize: '0.8125rem' }}>
                    🌐 Website
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Songs */}
      <div className="section">
        <div className="section-header">
          <h2>🎵 Songs ({songs.length})</h2>
          <Link to="/songs" className="btn btn-ghost btn-sm">Browse all songs →</Link>
        </div>
        {songs.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
            <div className="empty-icon">🎵</div>
            <h3>No songs yet</h3>
            <p>This artist hasn't released any approved songs.</p>
          </div>
        ) : (
          <div className="grid-3">
            {songs.map(s => (
              <div key={s.id} className="media-card">
                <div className="media-card-thumb">
                  {getSongCoverImage(s) ? <img src={getSongCoverImage(s)} alt={s.title} /> : '🎵'}
                </div>
                <div className="media-card-body">
                  <div className="media-card-title">{s.title}</div>
                  <div className="media-card-meta">
                    {s.genres?.name && <span className="genre-tag" style={{ fontSize: '0.7rem' }}>{s.genres.name}</span>}
                    <span>🎧 {(s.play_count || 0).toLocaleString()}</span>
                    {s.price > 0 && <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>${Number(s.price).toFixed(2)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videos */}
      {videos.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>🎬 Videos ({videos.length})</h2>
          </div>
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
        </div>
      )}
    </div>
  )
}
