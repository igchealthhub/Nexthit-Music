import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getSongCoverImage, withSongCoverUrl } from '../lib/songCovers'
import SnippetPlayer from '../components/SnippetPlayer'
import './SongsPage.css'

export default function SongsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [songs, setSongs] = useState([])
  const [songsError, setSongsError] = useState('')
  const [rawSongsData, setRawSongsData] = useState(null)
  const [likeCounts, setLikeCounts] = useState({})
  const [ratingAvgs, setRatingAvgs] = useState({})
  const [ratingCounts, setRatingCounts] = useState({})
  const [userLikes, setUserLikes] = useState(new Set())
  const [userRatings, setUserRatings] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [userPurchases, setUserPurchases] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [activePlayer, setActivePlayer] = useState(null)
  const [commentModal, setCommentModal] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [purchaseModal, setPurchaseModal] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    if (checkout === 'success') {
      setCheckoutMessage('Payment received. Your full song access is being unlocked now.')
    }
    if (checkout === 'cancel') {
      setCheckoutError('Checkout was canceled. No charge was made.')
    }
  }, [])

  useEffect(() => { loadAll() }, [user])

  function isFullUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value)
  }

  async function resolveStorageUrl(value, bucket) {
    if (!value) return null
    if (isFullUrl(value)) return value
    const path = value.startsWith('/') ? value.slice(1) : value
    const { data, error } = supabase.storage.from(bucket).getPublicUrl(path)
    console.log('RESOLVE STORAGE URL', { bucket, value, path, data, error })
    if (error || !data?.publicUrl) {
      console.warn('Unable to resolve public URL for', { bucket, path, error })
      return value
    }
    return data.publicUrl
  }

  async function loadAll() {
    setLoading(true)
    setSongsError('')
    setRawSongsData(null)

    const { data: songData, error } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    console.log('SONGS QUERY RESULT:', songData)
    console.log('SONGS QUERY ERROR:', error)

    if (error) {
      setSongs([])
      setSongsError(error.message)
      setLoading(false)
      return
    }

    const enrichedSongs = await Promise.all((songData ?? []).map(async rawSong => {
      const song = withSongCoverUrl(rawSong)
      const coverImage = getSongCoverImage(song)
      const playable_audio_url = await resolveStorageUrl(song.audio_url, 'song-files')
      const playable_cover_url = await resolveStorageUrl(coverImage, 'cover-art')
      console.log('SONG URL RESOLVE', { title: song.title, audio_url: song.audio_url, playable_audio_url, cover_url: coverImage, playable_cover_url })
      return { ...song, playable_audio_url, playable_cover_url }
    }))

    setRawSongsData(enrichedSongs)
    setSongs(enrichedSongs)

    const ids = songData.map(s => s.id)

    setLikeCounts({})
    setRatingAvgs({})
    setRatingCounts({})
    setCommentCounts({})
    setUserLikes(new Set())
    setUserRatings({})
    setUserPurchases(new Set())

    if (ids.length > 0 && user) {
      const [likesData, ratingsData, commentData] = await Promise.all([
        supabase.from('likes').select('song_id').in('song_id', ids),
        supabase.from('ratings').select('song_id, rating').in('song_id', ids),
        supabase.from('comments').select('song_id').in('song_id', ids),
      ])

      const lc = {}
      likesData.data?.forEach(l => { lc[l.song_id] = (lc[l.song_id] || 0) + 1 })
      setLikeCounts(lc)

      const avgs = {}, counts = {}
      ratingsData.data?.forEach(r => {
        avgs[r.song_id] = (avgs[r.song_id] || 0) + r.rating
        counts[r.song_id] = (counts[r.song_id] || 0) + 1
      })
      Object.keys(avgs).forEach(id => { avgs[id] = avgs[id] / counts[id] })
      setRatingAvgs(avgs)
      setRatingCounts(counts)

      const cc = {}
      commentData.data?.forEach(c => { cc[c.song_id] = (cc[c.song_id] || 0) + 1 })
      setCommentCounts(cc)

      const [myLikes, myRatings, myPurchases] = await Promise.all([
        supabase.from('likes').select('song_id').eq('user_id', user.id).in('song_id', ids),
        supabase.from('ratings').select('song_id, rating').eq('user_id', user.id).in('song_id', ids),
        supabase.from('purchases').select('song_id').eq('buyer_id', user.id).in('song_id', ids),
      ])
      setUserLikes(new Set(myLikes.data?.map(l => l.song_id)))
      const ur = {}
      myRatings.data?.forEach(r => { ur[r.song_id] = r.rating })
      setUserRatings(ur)
      setUserPurchases(new Set(myPurchases.data?.map(p => p.song_id)))
    }

    setLoading(false)
  }

  async function authedApi(path, options = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('You must be logged in to continue.')

    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })

    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }

    if (!response.ok) {
      throw new Error(payload?.error || text || 'Request failed.')
    }

    return payload || {}
  }

  async function handleLike(song) {
    if (!user) { navigate('/login'); return }
    const liked = userLikes.has(song.id)
    setUserLikes(prev => {
      const next = new Set(prev)
      liked ? next.delete(song.id) : next.add(song.id)
      return next
    })
    setLikeCounts(prev => ({ ...prev, [song.id]: Math.max(0, (prev[song.id] || 0) + (liked ? -1 : 1)) }))
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('song_id', song.id)
    } else {
      await supabase.from('likes').insert({ user_id: user.id, song_id: song.id })
    }
  }

  async function handleRate(song, stars) {
    if (!user) { navigate('/login'); return }
    const existing = userRatings[song.id]
    setUserRatings(prev => ({ ...prev, [song.id]: stars }))
    if (existing) {
      await supabase.from('ratings').update({ rating: stars }).eq('user_id', user.id).eq('song_id', song.id)
    } else {
      await supabase.from('ratings').insert({ user_id: user.id, song_id: song.id, rating: stars })
    }
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
    supabase.from('song_plays').insert({
      song_id: song.id,
      user_id: user?.id || null,
      played_at: new Date().toISOString(),
    })
    supabase.from('songs').update({ play_count: (song.play_count || 0) + 1 }).eq('id', song.id)
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, play_count: (s.play_count || 0) + 1 } : s))
  }

  function handleBuy(song) {
    if (!user) { navigate('/login'); return }
    if (userPurchases.has(song.id)) return
    if (!song.price || song.price <= 0) {
      // Free song — grant access immediately
      setUserPurchases(prev => new Set([...prev, song.id]))
      return
    }
    setPurchaseModal(song)
  }

  async function confirmPurchase() {
    if (!purchaseModal || !user || purchasing) return
    setPurchasing(true)
    setCheckoutError('')
    setCheckoutMessage('')

    try {
      const result = await authedApi('/api/create-song-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ songId: purchaseModal.id }),
      })

      if (result?.alreadyPurchased) {
        setUserPurchases(prev => new Set([...prev, purchaseModal.id]))
        setCheckoutMessage('You already purchased this song. Full access is unlocked.')
        setPurchaseModal(null)
        setPurchasing(false)
        return
      }

      if (!result?.url) throw new Error('Stripe checkout URL was not returned.')
      window.location.assign(result.url)
    } catch (error) {
      setCheckoutError(`Checkout failed: ${error.message}`)
      setPurchasing(false)
      return
    }

    setPurchaseModal(null)
    setPurchasing(false)
  }

  const approvedSongs = songs.filter(song => String(song.status || '').trim().toLowerCase() === 'approved')

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎵 Songs</h1>
        <p>Stream 30-second previews — buy the full track to keep listening</p>
      </div>

      {checkoutMessage && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          {checkoutMessage}
        </div>
      )}
      {checkoutError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {checkoutError}
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : songsError ? (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.95rem' }}>
          <strong>SONGS ERROR:</strong> {songsError}
        </div>
      ) : approvedSongs.length === 0 ? (
        <div>
          <div className="empty-state">
            <div className="empty-icon">🎵</div>
            <h3>No approved songs yet</h3>
            <p>Only songs with <code>status = 'approved'</code> will appear here.</p>
            <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              Loaded songs: {songs.length}, approved songs: {approvedSongs.length}
            </p>
          </div>
          {rawSongsData && (
            <div className="alert alert-info" style={{ marginTop: '1.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              <strong>Raw songs response:</strong>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '320px', overflow: 'auto' }}>
                {JSON.stringify(rawSongsData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="songs-grid">
          {approvedSongs.map(song => {
            const purchased = userPurchases.has(song.id)
            const isFree = !song.price || song.price <= 0
            const hasFullAccess = purchased || isFree
            return (
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
                purchased={purchased}
                isFree={isFree}
                fullAccess={hasFullAccess}
                isActive={activePlayer === song.id}
                onPlay={() => {
                  setActivePlayer(song.id)
                  trackPlay(song)
                }}
                onLike={() => handleLike(song)}
                onRate={stars => handleRate(song, stars)}
                onComment={() => openComments(song)}
                onBuy={() => handleBuy(song)}
              />
            )
          })}
        </div>
      )}

      {/* Purchase confirmation modal */}
      {purchaseModal && (
        <div className="modal-overlay" onClick={() => !purchasing && setPurchaseModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>🎵 Buy Full Song</h2>
              <button className="btn btn-ghost" onClick={() => setPurchaseModal(null)} disabled={purchasing}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1.25rem 0' }}>
              <div style={{ width: 60, height: 60, borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
                {getSongCoverImage(purchaseModal) ? <img src={getSongCoverImage(purchaseModal)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: '1.0625rem' }}>{purchaseModal.title}</div>
                {purchaseModal.profiles?.display_name && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {purchaseModal.profiles.display_name}
                  </div>
                )}
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.375rem' }}>
                  ${Number(purchaseModal.price).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6 }}>
              💳 You will be redirected to Stripe Checkout to complete your purchase securely.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmPurchase} disabled={purchasing}>
                {purchasing ? 'Redirecting…' : `Continue to Checkout`}
              </button>
              <button className="btn btn-outline" onClick={() => setPurchaseModal(null)} disabled={purchasing}>Cancel</button>
            </div>
          </div>
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
                <button className="btn btn-primary btn-sm" type="submit" disabled={!commentText.trim()}>Post</button>
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
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.875rem', overflow: 'hidden' }}>
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

function SongCard({ song, user, liked, likeCount, avgRating, ratingCount, userRating, commentCount, purchased, isFree, fullAccess, isActive, onPlay, onLike, onRate, onComment, onBuy }) {
  const coverImage = getSongCoverImage(song)
  const genreName = song.genres?.name || null
  const artistProfile = song.profiles
  const title = song.title || 'Untitled'
  const rawAudioUrl = song.audio_url || ''
  const audioSrc = song.playable_audio_url || rawAudioUrl
  const rawCoverUrl = coverImage || ''
  const coverSrc = song.playable_cover_url || rawCoverUrl
  const priceValue = Number(song.price || 0)
  const displayPrice = priceValue > 0 ? priceValue.toFixed(2) : null

  useEffect(() => {
    console.log('SONG PLAYBACK', { title, rawAudioUrl, resolvedPlayableUrl: audioSrc })
  }, [title, rawAudioUrl, audioSrc])

  return (
    <div className={`song-card ${isActive ? 'active' : ''}`}>
      <div className="song-card-cover">
        {coverSrc
          ? <img src={coverSrc} alt={title} />
          : <span className="song-card-cover-placeholder">🎵</span>}
      </div>

      <div className="song-card-body">
        <div className="song-card-top">
          <div>
            <div className="song-card-title">{title}</div>
            <div className="song-card-meta">
              {artistProfile && (
                <Link to={`/artist/${artistProfile.id}`} style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none' }}>
                  {artistProfile.display_name || 'Artist'}
                      {artistProfile.verified && <span title="Verified" style={{ color: '#60a5fa', marginLeft: '2px' }}>✓</span>}
                </Link>
              )}
              {genreName && <span className="genre-tag">{genreName}</span>}
              <span>🎧 {(song.play_count || 0).toLocaleString()} plays</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
            {song.price > 0 && (
              <div className="song-price">${Number(song.price).toFixed(2)}</div>
            )}
            {purchased && <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>✅ Owned</span>}
            {isFree && <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'var(--surface-2)' }}>Free</span>}
          </div>
        </div>

        <SnippetPlayer src={audioSrc} songId={song.id} onPlayStart={onPlay} fullAccess={fullAccess} />

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

          {artistProfile && (
            user ? (
              user.id !== artistProfile.id && (
                <Link to={`/messages?user=${artistProfile.id}`} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                  Message Artist
                </Link>
              )
            ) : (
              <Link to="/login" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                Message Artist
              </Link>
            )
          )}

          {song.price > 0 && !purchased ? (
            <button className="btn btn-primary btn-sm buy-btn" onClick={onBuy}>
              Buy Full Song
            </button>
          ) : song.price > 0 && purchased ? (
            <span className="btn btn-outline btn-sm buy-btn" style={{ opacity: 0.7, cursor: 'default' }}>✅ Purchased</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
