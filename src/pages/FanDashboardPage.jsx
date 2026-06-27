import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const NOTIF_ICONS = {
  song_approved: '✅', song_rejected: '❌', song_purchased: '💰',
  new_follower: '👥', new_comment: '💬', general: '🔔',
}

export default function FanDashboardPage() {
  const { user, profile } = useAuth()
  const [likedSongs, setLikedSongs] = useState([])
  const [recentPlays, setRecentPlays] = useState([])
  const [followedArtists, setFollowedArtists] = useState([])
  const [purchases, setPurchases] = useState([])
  const [notifications, setNotifications] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(false)
  const [contestEntries, setContestEntries] = useState([])
  const [points, setPoints] = useState(null)
  const [badges, setBadges] = useState([])
  const [recommended, setRecommended] = useState([])
  const [loading, setLoading] = useState(true)

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'there'

  useEffect(() => {
    async function load() {
      const [likesRes, playsRes, recommendedRes, purchasesRes, notifRes] = await Promise.all([
        supabase.from('likes')
          .select('song_id, songs(id, title, cover_url, play_count)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('song_plays')
          .select('song_id, played_at, songs(id, title, cover_url)')
          .eq('user_id', user.id)
          .order('played_at', { ascending: false })
          .limit(6),
        supabase.from('songs')
          .select('id, title, cover_url, play_count')
          .eq('status', 'approved')
          .order('play_count', { ascending: false })
          .limit(8),
        supabase.from('purchases')
          .select('song_id, created_at, songs(id, title, cover_url, play_count)')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setLikedSongs(likesRes.data?.map(l => l.songs).filter(Boolean) || [])
      setRecentPlays(playsRes.data?.filter(p => p.songs) || [])
      setRecommended(recommendedRes.data || [])
      if (!purchasesRes.error) setPurchases(purchasesRes.data || [])
      if (!notifRes.error) setNotifications(notifRes.data || [])

      // Follows — two-step to avoid ambiguous FK
      const followsRes = await supabase.from('follows').select('artist_id').eq('follower_id', user.id)
      if (!followsRes.error && followsRes.data?.length) {
        const artistIds = followsRes.data.map(f => f.artist_id)
        const artistRes = await supabase.from('profiles').select('id, display_name, email, avatar_url').in('id', artistIds)
        setFollowedArtists(artistRes.data || [])
      }

      // Optional tables
      const [playlistsRes, pointsRes, entriesRes, badgesRes] = await Promise.all([
        supabase.from('playlists').select('id, name, is_public').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('fan_points').select('points').eq('user_id', user.id).maybeSingle(),
        supabase.from('contest_entries').select('id, contests(id, title, status)').eq('user_id', user.id).limit(5),
        supabase.from('user_badges').select('badge_id, badges(id, name, icon)').eq('user_id', user.id),
      ])

      if (!playlistsRes.error) setPlaylists(playlistsRes.data || [])
      if (!pointsRes.error && pointsRes.data) setPoints(pointsRes.data.points)
      if (!entriesRes.error) setContestEntries(entriesRes.data?.map(e => e.contests).filter(Boolean) || [])
      if (!badgesRes.error) setBadges(badgesRes.data?.map(b => b.badges).filter(Boolean) || [])

      setLoading(false)
    }
    load()
  }, [user.id])

  async function createPlaylist(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('playlists').insert({
      user_id: user.id, name: newPlaylistName, is_public: newPlaylistPublic,
    }).select('id, name, is_public').single()
    if (error) { alert(error.message); return }
    setPlaylists(prev => [data, ...prev])
    setNewPlaylistName('')
    setNewPlaylistPublic(false)
    setCreatePlaylistOpen(false)
  }

  async function markNotifRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const purchasedSongs = purchases.map(p => p.songs).filter(Boolean)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Hey, {displayName} 👋</h1>
          <p style={{ marginTop: '0.25rem', color: 'var(--text)' }}>Welcome back to NextHit</p>
        </div>
        <span className="badge badge-fan">Fan</span>
      </div>

      {/* CTA buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
        <Link to="/songs" className="btn btn-primary">🎵 Browse Songs</Link>
        <Link to="/videos" className="btn btn-outline">🎬 Browse Videos</Link>
        <Link to="/trending" className="btn btn-outline">📈 Trending</Link>
        <Link to="/contests" className="btn btn-outline">🏆 Contests</Link>
        <Link to="/messages" className="btn btn-outline">💬 Messages</Link>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f87171' }}>{likedSongs.length}</div>
          <div className="stat-label">Liked Songs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-2)' }}>{purchasedSongs.length}</div>
          <div className="stat-label">Purchased</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{followedArtists.length}</div>
          <div className="stat-label">Following</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{playlists.length}</div>
          <div className="stat-label">Playlists</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#fbbf24' }}>{points ?? 0}</div>
          <div className="stat-label">Fan Points</div>
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>🔔 Notifications <span className="notif-badge" style={{ position: 'static', display: 'inline-flex', marginLeft: '0.375rem', background: 'var(--accent-2)', color: '#fff', fontSize: '0.7rem', padding: '0 5px', height: 18, borderRadius: 9, alignItems: 'center' }}>{notifications.length}</span></h2>
            <Link to="/notifications" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {notifications.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>
                  {NOTIF_ICONS[n.type] || '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.875rem' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: '0.125rem' }}>{n.body}</div>}
                </div>
                <button
                  onClick={() => markNotifRead(n.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.25rem 0', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchased Songs */}
      {purchasedSongs.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>🛒 Purchased Songs</h2>
            <Link to="/songs" className="btn btn-ghost btn-sm">Browse more →</Link>
          </div>
          <div className="grid-4">
            {purchasedSongs.map(s => <SongCard key={s.id} song={s} />)}
          </div>
        </div>
      )}

      {/* Liked Songs */}
      <div className="section">
        <div className="section-header">
          <h2>❤️ Liked Songs</h2>
          <Link to="/songs" className="btn btn-ghost btn-sm">Browse more →</Link>
        </div>
        {likedSongs.length === 0 ? (
          <DashEmpty icon="❤️" title="No liked songs yet" sub="Tap the heart on any song to save it here." />
        ) : (
          <div className="grid-4">
            {likedSongs.map(s => <SongCard key={s.id} song={s} />)}
          </div>
        )}
      </div>

      {/* Recently Played */}
      <div className="section">
        <div className="section-header">
          <h2>🎧 Recently Played</h2>
        </div>
        {recentPlays.length === 0 ? (
          <DashEmpty icon="🎧" title="No plays yet" sub="Start listening — your history appears here." />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {recentPlays.map((p, i) => (
              <div key={i} className="list-row">
                <div className="list-thumb">
                  {p.songs.cover_url ? <img src={p.songs.cover_url} alt="" /> : '🎵'}
                </div>
                <div className="list-info">
                  <div className="list-title">{p.songs.title}</div>
                  <div className="list-sub">{new Date(p.played_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Followed Artists */}
      <div className="section">
        <div className="section-header">
          <h2>🎤 Artists You Follow</h2>
        </div>
        {followedArtists.length === 0 ? (
          <DashEmpty icon="🎤" title="Not following anyone yet" sub="Follow your favorite artists to keep up with their releases." />
        ) : (
          <div className="grid-4">
            {followedArtists.map(a => (
              <Link key={a.id} to={`/artist/${a.id}`} style={{ textDecoration: 'none' }}>
                <div className="card card-sm" style={{ textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 0.5rem', overflow: 'hidden' }}>
                    {a.avatar_url ? <img src={a.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '🎤'}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.875rem' }}>
                    {a.display_name || a.email?.split('@')[0]}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Playlists + Contest Entries */}
      <div className="grid-2" style={{ marginBottom: '2.5rem' }}>
        <div>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2>📋 Playlists</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setCreatePlaylistOpen(true)}>+ New</button>
          </div>
          {playlists.length === 0 ? (
            <DashEmpty icon="📋" title="No playlists yet" sub="Create a playlist to organize your music." />
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {playlists.map(p => (
                <Link key={p.id} to={`/playlist/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="list-row">
                    <div className="list-thumb" style={{ background: 'var(--surface-3)' }}>📋</div>
                    <div className="list-info">
                      <div className="list-title">{p.name}</div>
                      {p.is_public && <div className="list-sub">Public</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h2>🏆 Contest Entries</h2>
          </div>
          {contestEntries.length === 0 ? (
            <DashEmpty icon="🏆" title="No entries yet" sub={<><Link to="/contests">Browse contests</Link> to vote and enter.</>} />
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {contestEntries.map((c, i) => (
                <Link key={i} to={`/contest/${c.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="list-row">
                    <div className="list-thumb" style={{ background: 'var(--surface-3)' }}>🏆</div>
                    <div className="list-info">
                      <div className="list-title">{c.title}</div>
                      <div className="list-sub">{c.status}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="section">
          <div className="section-header"><h2>🏅 Badges Earned</h2></div>
          <div className="grid-4">
            {badges.map((b, i) => (
              <div key={i} className="card card-sm" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.375rem' }}>{b.icon || '🏅'}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-h)', fontWeight: 600 }}>{b.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended */}
      <div className="section">
        <div className="section-header">
          <h2>✨ Recommended For You</h2>
          <Link to="/songs" className="btn btn-ghost btn-sm">See all →</Link>
        </div>
        {recommended.length === 0 ? (
          <DashEmpty icon="✨" title="Nothing to recommend yet" sub="Check back after more songs are approved." />
        ) : (
          <div className="grid-4">
            {recommended.map(s => <SongCard key={s.id} song={s} />)}
          </div>
        )}
      </div>
      <CreatePlaylistModal
        open={createPlaylistOpen}
        onClose={() => setCreatePlaylistOpen(false)}
        onSubmit={createPlaylist}
        name={newPlaylistName}
        setName={setNewPlaylistName}
        isPublic={newPlaylistPublic}
        setPublic={setNewPlaylistPublic}
      />
    </div>
  )
}

function CreatePlaylistModal({ open, onClose, onSubmit, name, setName, isPublic, setPublic }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>📋 New Playlist</h2>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Playlist Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="My Playlist" required autoFocus />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)' }}>
            <input type="checkbox" checked={isPublic} onChange={e => setPublic(e.target.checked)} />
            Make this playlist public (shareable)
          </label>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button className="btn btn-primary" type="submit">Create</button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SongCard({ song }) {
  return (
    <div className="media-card">
      <div className="media-card-thumb">
        {song.cover_url ? <img src={song.cover_url} alt={song.title} /> : '🎵'}
      </div>
      <div className="media-card-body">
        <div className="media-card-title">{song.title}</div>
        <div className="media-card-meta">🎧 {(song.play_count || 0).toLocaleString()} plays</div>
      </div>
    </div>
  )
}

function DashEmpty({ icon, title, sub }) {
  return (
    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {sub && <p style={{ marginTop: '0.25rem' }}>{sub}</p>}
    </div>
  )
}
