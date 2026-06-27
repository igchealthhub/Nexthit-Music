import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function PlaylistDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState(null)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPublic, setEditPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddSong, setShowAddSong] = useState(false)
  const [songSearch, setSongSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(null)

  const isOwner = user?.id === playlist?.user_id

  useEffect(() => { load() }, [id, user?.id])

  async function load() {
    setLoading(true)
    const playlistRes = await supabase.from('playlists').select('*').eq('id', id).maybeSingle()
    if (!playlistRes.data) { setNotFound(true); setLoading(false); return }

    const pl = playlistRes.data
    if (!pl.is_public && pl.user_id !== user?.id) { setAccessDenied(true); setLoading(false); return }

    setPlaylist(pl)
    setEditName(pl.name)
    setEditPublic(pl.is_public || false)

    const songsRes = await supabase
      .from('playlist_songs')
      .select('id, position, song_id, songs(id, title, cover_url, play_count, price, genres(name))')
      .eq('playlist_id', id)
      .order('position')

    setSongs(songsRes.data || [])
    setLoading(false)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('playlists').update({ name: editName, is_public: editPublic }).eq('id', id)
    if (error) { alert(error.message); setSaving(false); return }
    setPlaylist(p => ({ ...p, name: editName, is_public: editPublic }))
    setEditing(false)
    setSaving(false)
  }

  async function removeSong(playlistSongId) {
    await supabase.from('playlist_songs').delete().eq('id', playlistSongId)
    setSongs(prev => prev.filter(s => s.id !== playlistSongId))
  }

  async function deletePlaylist() {
    if (!confirm('Delete this playlist? This cannot be undone.')) return
    await supabase.from('playlists').delete().eq('id', id)
    navigate('/dashboard')
  }

  async function searchSongs(q) {
    setSongSearch(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('songs')
      .select('id, title, cover_url, genres(name)')
      .eq('status', 'approved')
      .ilike('title', `%${q}%`)
      .limit(10)
    const existing = new Set(songs.map(s => s.song_id))
    setSearchResults((data || []).filter(s => !existing.has(s.id)))
    setSearching(false)
  }

  async function addSong(song) {
    if (adding === song.id) return
    setAdding(song.id)
    const maxPos = songs.length ? Math.max(...songs.map(s => s.position || 0)) : 0
    const { data, error } = await supabase.from('playlist_songs')
      .insert({ playlist_id: id, song_id: song.id, position: maxPos + 1 })
      .select('id, position, song_id, songs(id, title, cover_url, play_count, price, genres(name))')
      .single()
    if (error) { alert(error.message); setAdding(null); return }
    setSongs(prev => [...prev, data])
    setSearchResults(prev => prev.filter(s => s.id !== song.id))
    setAdding(null)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (notFound) return (
    <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
      <h1>Playlist Not Found</h1>
      <p style={{ margin: '1rem 0 2rem', color: 'var(--text)' }}>This playlist doesn't exist or has been removed.</p>
      <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
    </div>
  )

  if (accessDenied) return (
    <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
      <h1>Private Playlist</h1>
      <p style={{ margin: '1rem 0 2rem', color: 'var(--text)' }}>This playlist is private.</p>
      <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
    </div>
  )

  const totalPlays = songs.reduce((sum, s) => sum + (s.songs?.play_count || 0), 0)

  return (
    <div className="page" style={{ maxWidth: 740 }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {editing ? (
          <form onSubmit={saveEdit}>
            <div className="form-group">
              <label>Playlist Name</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} />
              <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Make this playlist public (shareable)</span>
            </label>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📋</div>
                <div>
                  <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{playlist.name}</h1>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {playlist.is_public
                      ? <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Public</span>
                      : <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>Private</span>}
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {songs.length} song{songs.length !== 1 ? 's' : ''} · {totalPlays.toLocaleString()} plays
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {isOwner && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowAddSong(v => !v)}>+ Add Song</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={deletePlaylist}>Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add song panel */}
      {showAddSong && isOwner && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--accent)' }}>
          <h3 style={{ marginBottom: '0.875rem', fontSize: '0.9375rem' }}>Add Songs</h3>
          <input
            className="input"
            placeholder="Search approved songs…"
            value={songSearch}
            onChange={e => searchSongs(e.target.value)}
            autoFocus
          />
          {searching && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Searching…</div>}
          {searchResults.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {searchResults.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.625rem', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--surface-3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.cover_url ? <img src={s.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-h)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    {s.genres?.name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.genres.name}</div>}
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.75rem', flexShrink: 0 }}
                    onClick={() => addSong(s)}
                    disabled={adding === s.id}
                  >
                    {adding === s.id ? '…' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {songSearch && !searching && searchResults.length === 0 && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>No songs found.</div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.875rem' }} onClick={() => { setShowAddSong(false); setSongSearch(''); setSearchResults([]) }}>Done</button>
        </div>
      )}

      {/* Songs list */}
      {songs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <h3>No songs yet</h3>
          {isOwner ? <p>Click "Add Song" to start building your playlist.</p> : <p>This playlist has no songs yet.</p>}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {songs.map((ps, i) => {
            const s = ps.songs
            if (!s) return null
            return (
              <div key={ps.id} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 1rem', borderBottom: i < songs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 22, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                  {s.cover_url ? <img src={s.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {s.genres?.name && <span>{s.genres.name}</span>}
                    <span>🎧 {(s.play_count || 0).toLocaleString()}</span>
                    {s.price > 0 && <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>${Number(s.price).toFixed(2)}</span>}
                  </div>
                </div>
                {isOwner && (
                  <button
                    onClick={() => removeSong(ps.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem', flexShrink: 0 }}
                    title="Remove from playlist"
                  >✕</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
