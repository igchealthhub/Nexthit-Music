import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import SnippetPlayer from '../components/SnippetPlayer'
import './SongsPage.css'

export default function SongsPage() {
  const { user } = useAuth()
  const [songs, setSongs] = useState([])
  const [likeCounts, setLikeCounts] = useState({})
  const [ratingAvgs, setRatingAvgs] = useState({})
  const [ratingCounts, setRatingCounts] = useState({})
  const [userLikes, setUserLikes] = useState(new Set())
  const [userRatings, setUserRatings] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [activePlayer, setActivePlayer] = useState(null)
  const [commentModal, setCommentModal] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)

  useEffect(() => {
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)

    const { data: songData } = await supabase
      .from('songs')
      .select('*, genres(name)')
      .eq('status', 'approved')
      .order('play_count', { ascending: false })

    if (!songData?.length) { setSongs([]); setLoading(false); return }
    setSongs(songData)

    const ids = songData.map(s => s.id)

    // Likes counts
    const { data: likesData } = await supabase.from('likes').select('song_id').in('song_id', ids)
    const lc = {}
    likesData?.forEach(l => { lc[l.song_id] = (lc[l.song_id] || 0) + 1 })
    setLikeCounts(lc)

    // Ratings
    const { data: ratingsData } = await supabase.from('ratings').select('song_id, rating').in('song_id', ids)
    const avgs = {}, counts = {}
    ratingsData?.forEach(r => {
      avgs[r.song_id] = (avgs[r.song_id] || 0) + r.rating
      counts[r.song_id] = (counts[r.song_id] || 0) + 1
    })
    Object.keys(avgs).forEach(id => { avgs[id] = avgs[id] / counts[id] })
    setRatingAvgs(avgs)
    setRatingCounts(counts)

    // Comment counts
    const { data: commentData } = await supabase.from('comments').select('song_id').in('song_id', ids)
    const cc = {}
    commentData?.forEach(c => { cc[c.song_id] = (cc[c.song_id] || 0) + 1 })
    setCommentCounts(cc)

    // Current user's likes + ratings
    if (user) {
      const { data: myLikes } = await supabase.from('likes').select('song_id').eq('user_id', user.id).in('song_id', ids)
      setUserLikes(new Set(myLikes?.map(l => l.song_id)))

      const { data: myRatings } = await supabase.from('ratings').select('song_id, rating').eq('user_id', user.id).in('song_id', ids)
      const ur = {}
      myRatings?.forEach(r => { ur[r.song_id] = r.rating })
      setUserRatings(ur)
    }

    setLoading(false)
  }

  async function handleLike(song) {
    if (!user) return
    const liked = userLikes.has(song.id)

    // Optimistic update
    setUserLikes(prev => {
      const next = new Set(prev)
      liked ? next.delete(song.id) : next.add(song.id)
      return next
    })
    setLikeCounts(prev => ({ ...prev, [song.id]: (prev[song.id] || 0) + (liked ? -1 : 1) }))

    if (liked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('song_id', song.id)
    } else {
      await supabase.from('likes').insert({ user_id: user.id, song_id: song.id })
    }
  }

  async function handleRate(song, stars) {
    if (!user) return
    const existing = userRatings[song.id]

    setUserRatings(prev => ({ ...prev, [song.id]: stars }))

    if (existing) {
      await supabase.from('ratings').update({ rating: stars }).eq('user_id', user.id).eq('song_id', song.id)
    } else {
      await supabase.from('ratings').insert({ user_id: user.id, song_id: song.id, rating: stars })
    }

    // Refetch avg for this song
    const { data } = await supabase.from('ratings').select('rating').eq('song_id', song.id)
    if (data?.length) {
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length
      setRatingAvgs(prev => ({ ...prev, [song.id]: avg }))
      setRatingCounts(prev => ({ ...prev, [song.id]: data.length }))
    }
  }

  async function openComments(song) {
    setCommentModal(song)
    setCommentText('')
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('song_id', song.id)
      .order('created_at', { ascending: false })
    setComments(data || [])
    setLoadingComments(false)
  }

  async function submitComment(e) {
    e.preventDefault()
    if (!commentText.trim() || !user || !commentModal) return
    const { data, error } = await supabase
      .from('comments')
      .insert({ user_id: user.id, song_id: commentModal.id, comment: commentText.trim() })
      .select('*, profiles(display_name, avatar_url)')
      .single()
    if (!error && data) {
      setComments(prev => [data, ...prev])
      setCommentCounts(prev => ({ ...prev, [commentModal.id]: (prev[commentModal.id] || 0) + 1 }))
      setCommentText('')
    }
  }

  async function trackPlay(song) {
    // Insert play record
    supabase.from('song_plays').insert({
      song_id: song.id,
      user_id: user?.id || null,
      played_at: new Date().toISOString(),
    })
    // Increment play_count
    supabase.from('songs').update({ play_count: (song.play_count || 0) + 1 }).eq('id', song.id)
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, play_count: (s.play_count || 0) + 1 } : s))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎵 Songs</h1>
        <p>Stream 30-second previews — buy the full track to keep listening</p>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : songs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <h3>No songs yet</h3>
          <p>Approved tracks will appear here.</p>
        </div>
      ) : (
        <div className="songs-grid">
          {songs.map(song => (
            <SongCard
              key={song.id}
              song={song}
              user={user}
              liked={userLikes.has(song.id)}
              likeCount={likeCounts[song.id] || 0}
              avgRating={ratingAvgs[song.id] || 0}
              ratingCount={ratingCounts[song.id] || 0}
              userRating={userRatings[song.id] || 0}
              commentCount={commentCounts[song.id] || 0}
              isActive={activePlayer === song.id}
              onPlay={() => {
                setActivePlayer(song.id)
                trackPlay(song)
              }}
              onLike={() => handleLike(song)}
              onRate={stars => handleRate(song, stars)}
              onComment={() => openComments(song)}
            />
          ))}
        </div>
      )}

      {/* Comments modal */}
      {commentModal && (
        <div className="modal-overlay" onClick={() => setCommentModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💬 Comments — {commentModal.title}</h2>
              <button className="btn btn-ghost" onClick={() => setCommentModal(null)}>✕</button>
            </div>

            {user ? (
              <form onSubmit={submitComment} style={{ marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <textarea
                    className="input"
                    placeholder="Add a comment…"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    rows={2}
                  />
                </div>
                <button className="btn btn-primary btn-sm" type="submit" disabled={!commentText.trim()}>
                  Post
                </button>
              </form>
            ) : (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <Link to="/login">Log in</Link> to leave a comment.
              </div>
            )}

            {loadingComments ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : comments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>No comments yet. Be first!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '40vh', overflowY: 'auto' }}>
                {comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.625rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.875rem' }}>
                      {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '👤'}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-h)', marginBottom: '0.125rem' }}>
                        {c.profiles?.display_name || 'User'}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{c.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SongCard({ song, user, liked, likeCount, avgRating, ratingCount, userRating, commentCount, isActive, onPlay, onLike, onRate, onComment }) {
  const genreName = song.genres?.name || null

  return (
    <div className={`song-card ${isActive ? 'active' : ''}`}>
      <div className="song-card-cover">
        {song.cover_url
          ? <img src={song.cover_url} alt={song.title} />
          : <span className="song-card-cover-placeholder">🎵</span>}
      </div>

      <div className="song-card-body">
        <div className="song-card-top">
          <div>
            <div className="song-card-title">{song.title}</div>
            <div className="song-card-meta">
              {genreName && <span className="genre-tag">{genreName}</span>}
              <span>🎧 {(song.play_count || 0).toLocaleString()} plays</span>
            </div>
          </div>
          {song.price > 0 && (
            <div className="song-price">${Number(song.price).toFixed(2)}</div>
          )}
        </div>

        <SnippetPlayer src={song.audio_url} songId={song.id} onPlayStart={onPlay} />

        <div className="song-card-actions">
          <button
            className={`action-btn ${liked ? 'liked' : ''}`}
            onClick={onLike}
            title={user ? (liked ? 'Unlike' : 'Like') : 'Log in to like'}
          >
            {liked ? '❤️' : '🤍'} {likeCount > 0 && likeCount}
          </button>

          <div className="star-rating">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                className={`star-btn ${s <= (userRating || Math.round(avgRating)) ? 'filled' : ''}`}
                onClick={() => onRate(s)}
                title={user ? `Rate ${s} star${s > 1 ? 's' : ''}` : 'Log in to rate'}
              >★</button>
            ))}
            {ratingCount > 0 && (
              <span className="rating-count">{avgRating.toFixed(1)} ({ratingCount})</span>
            )}
          </div>

          <button className="action-btn" onClick={onComment}>
            💬 {commentCount > 0 && commentCount}
          </button>

          {song.price > 0 ? (
            <button className="btn btn-primary btn-sm buy-btn">Buy Full Song</button>
          ) : (
            <button className="btn btn-outline btn-sm buy-btn" disabled style={{ opacity: 0.5 }}>Free</button>
          )}
        </div>
      </div>
    </div>
  )
}
