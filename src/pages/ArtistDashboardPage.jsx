import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getSongCoverImage, withSongCoverUrl } from '../lib/songCovers'

const STATUS_STYLE = {
  pending:  { badge: 'badge-pending', label: '⏳ Pending' },
  approved: { badge: 'badge-active',  label: '✅ Live'    },
  rejected: { badge: 'badge-admin',   label: '❌ Rejected' },
  draft:    { badge: 'badge-fan',     label: 'Draft'       },
}

export default function ArtistDashboardPage() {
  const { user, profile } = useAuth()
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [likeCounts, setLikeCounts] = useState({})
  const [ratingAvgs, setRatingAvgs] = useState({})
  const [ratingCounts, setRatingCounts] = useState({})
  const [recentComments, setRecentComments] = useState([])
  const [followerCount, setFollowerCount] = useState(0)
  const [contestEntries, setContestEntries] = useState([])
  const [songPurchases, setSongPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('songs')
  const [stripeStatus, setStripeStatus] = useState({
    connected: false,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
  })
  const [stripeLoading, setStripeLoading] = useState(true)
  const [stripeBusy, setStripeBusy] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [stripeNotice, setStripeNotice] = useState('')

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Artist'

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

  async function refreshStripeStatus() {
    try {
      setStripeLoading(true)
      setStripeError('')
      const status = await authedApi('/api/stripe/account-status', { method: 'GET' })
      setStripeStatus({
        connected: status.connected === true,
        onboardingComplete: status.onboardingComplete === true,
        chargesEnabled: status.chargesEnabled === true,
        payoutsEnabled: status.payoutsEnabled === true,
      })
    } catch (error) {
      setStripeError(error.message)
    } finally {
      setStripeLoading(false)
    }
  }

  async function connectStripe() {
    try {
      setStripeBusy(true)
      setStripeError('')

      await authedApi('/api/stripe/create-connect-account', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const link = await authedApi('/api/stripe/create-account-link', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      if (!link?.url) throw new Error('Stripe onboarding link was not returned.')
      window.location.assign(link.url)
    } catch (error) {
      setStripeError(error.message)
      setStripeBusy(false)
    }
  }

  useEffect(() => {
    async function load() {
      const [s, v, followsRes] = await Promise.all([
        supabase.from('songs').select('*, genres(name)').eq('artist_id', user.id).order('created_at', { ascending: false }),
        supabase.from('videos').select('*').eq('artist_id', user.id).order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('artist_id', user.id),
      ])

      const songData = (s.data || []).map(withSongCoverUrl)
      setSongs(songData)
      setVideos(v.data || [])
      setFollowerCount(followsRes.count || 0)

      if (songData.length) {
        const ids = songData.map(s => s.id)
        const songTitles = {}
        songData.forEach(s => { songTitles[s.id] = s.title })

        const [likes, ratings, comments, purchasesRes] = await Promise.all([
          supabase.from('likes').select('song_id').in('song_id', ids),
          supabase.from('ratings').select('song_id, rating').in('song_id', ids),
          supabase.from('comments')
            .select('id, song_id, comment, created_at')
            .in('song_id', ids)
            .order('created_at', { ascending: false })
            .limit(8),
          supabase.from('purchases')
            .select('id, song_id, amount, created_at')
            .in('song_id', ids),
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

        setRecentComments((comments.data || []).map(c => ({ ...c, songTitle: songTitles[c.song_id] })))
        if (!purchasesRes.error) setSongPurchases(purchasesRes.data || [])
      }

      // Contest entries (artist_id column)
      const entriesRes = await supabase
        .from('contest_entries')
        .select('id, contest_id, contests(id, title, status)')
        .eq('artist_id', user.id)
        .limit(5)
      if (!entriesRes.error) {
        setContestEntries(entriesRes.data?.map(e => e.contests).filter(Boolean) || [])
      }

      setLoading(false)
    }
    load()
  }, [user.id])

  useEffect(() => {
    refreshStripeStatus()
  }, [user.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stripe = params.get('stripe')
    if (stripe === 'return') {
      setStripeNotice('Returned from Stripe. Refreshing status...')
      refreshStripeStatus()
    }
    if (stripe === 'refresh') {
      setStripeNotice('Stripe setup is incomplete. Continue setup to receive payouts.')
    }
  }, [])

  async function deleteSong(id) {
    if (!confirm('Delete this song? This cannot be undone.')) return
    const { error } = await supabase.from('songs').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setSongs(prev => prev.filter(s => s.id !== id))
  }

  async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return
    const { error } = await supabase.from('videos').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  const totalPlays    = songs.reduce((sum, s) => sum + (s.play_count || 0), 0)
  const totalLikes    = Object.values(likeCounts).reduce((a, b) => a + b, 0)
  const approvedCount = songs.filter(s => s.status === 'approved').length
  const pendingCount  = songs.filter(s => s.status === 'pending').length
  const rejectedCount = songs.filter(s => s.status === 'rejected').length
  const maxPlays      = Math.max(...songs.map(s => s.play_count || 0), 1)

  const totalRevenue = songPurchases.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalSales   = songPurchases.length
  const purchasesBySong = songs.reduce((acc, s) => {
    const ps = songPurchases.filter(p => p.song_id === s.id)
    if (ps.length > 0) acc.push({
      id: s.id,
      title: s.title,
      count: ps.length,
      revenue: ps.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    })
    return acc
  }, []).sort((a, b) => b.revenue - a.revenue)

  const stripeStatusLabel = !stripeStatus.connected
    ? 'Not connected'
    : stripeStatus.payoutsEnabled
      ? 'Payouts enabled'
      : stripeStatus.onboardingComplete
        ? 'Connected'
        : 'Setup incomplete'

  const stripeStatusMessage = !stripeStatus.connected
    ? 'Finish setup to receive payouts.'
    : stripeStatus.payoutsEnabled
      ? 'Stripe payouts are enabled.'
      : stripeStatus.onboardingComplete
        ? 'Stripe is connected.'
        : 'Finish setup to receive payouts.'

  const stripeActionLabel = !stripeStatus.connected ? 'Connect Stripe' : 'Continue Stripe Setup'

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🎤 {displayName}</h1>
          <div style={{ marginTop: '0.375rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-artist">Artist</span>
            {profile?.is_admin && <span className="badge badge-admin">Admin</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/upload/song" className="btn btn-primary btn-sm">+ Upload Song</Link>
          <Link to="/upload/video" className="btn btn-outline btn-sm">+ Upload Video</Link>
          <Link to="/messages" className="btn btn-outline btn-sm">💬 Messages</Link>
          <Link to="/contests" className="btn btn-outline btn-sm">🏆 Contests</Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ marginBottom: '0.4rem' }}>💳 Get Paid with Stripe</h3>
            {stripeLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Checking Stripe account status...</p>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><strong>Status:</strong> {stripeStatusLabel}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{stripeStatusMessage}</p>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className={`badge ${stripeStatus.connected ? 'badge-active' : 'badge-pending'}`}>{stripeStatusLabel}</span>
            <span className={`badge ${stripeStatus.chargesEnabled ? 'badge-active' : 'badge-pending'}`}>
              {stripeStatus.chargesEnabled ? 'Charges On' : 'Charges Pending'}
            </span>
            <span className={`badge ${stripeStatus.payoutsEnabled ? 'badge-active' : 'badge-pending'}`}>
              {stripeStatus.payoutsEnabled ? 'Payouts On' : 'Payouts Pending'}
            </span>
          </div>
        </div>

        {stripeNotice && (
          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            {stripeNotice}
          </div>
        )}

        {stripeError && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            Stripe error: {stripeError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={connectStripe} disabled={stripeBusy}>
            {stripeBusy ? 'Opening Stripe...' : stripeActionLabel}
          </button>
          <button className="btn btn-outline btn-sm" onClick={refreshStripeStatus} disabled={stripeLoading}>
            Refresh Status
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          {/* Stats */}
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
              <div className="stat-label">Likes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{followerCount}</div>
              <div className="stat-label">Followers</div>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
              ⏳ You have {pendingCount} song{pendingCount > 1 ? 's' : ''} pending review. They'll go live once approved.
            </div>
          )}
          {rejectedCount > 0 && (
            <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
              ❌ {rejectedCount} song{rejectedCount > 1 ? 's were' : ' was'} rejected. Upload a revised version or contact support.
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'songs',     label: `🎵 Songs (${songs.length})`  },
              { key: 'videos',    label: `🎬 Videos (${videos.length})` },
              { key: 'analytics', label: '📊 Analytics'                 },
            ].map(t => (
              <button key={t.key}
                className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTab(t.key)}
              >{t.label}</button>
            ))}
          </div>

          {/* Songs tab */}
          {tab === 'songs' && (
            songs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎵</div>
                <h3>No songs yet</h3>
                <p>Upload your first song to get started.</p>
                <Link to="/upload/song" className="btn btn-primary" style={{ marginTop: '1rem' }}>Upload Song</Link>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Song</th><th>Status</th><th>Plays</th><th>Likes</th><th>Rating</th><th>Price</th><th></th></tr>
                    </thead>
                    <tbody>
                      {songs.map(s => {
                        const st = STATUS_STYLE[s.status] || STATUS_STYLE.draft
                        const avgR = ratingAvgs[s.id]
                        return (
                          <tr key={s.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {getSongCoverImage(s)
                                    ? <img src={getSongCoverImage(s)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : '🎵'}
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
                                  ⭐ {avgR.toFixed(1)}{' '}
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({ratingCounts[s.id]})</span>
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td>
                              {s.price > 0
                                ? `$${Number(s.price).toFixed(2)}`
                                : <span style={{ color: 'var(--text-muted)' }}>Free</span>}
                            </td>
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

          {/* Videos tab */}
          {tab === 'videos' && (
            videos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎬</div>
                <h3>No videos yet</h3>
                <p>Upload your first video to grow your audience.</p>
                <Link to="/upload/video" className="btn btn-primary" style={{ marginTop: '1rem' }}>Upload Video</Link>
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
                            <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {new Date(v.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => deleteVideo(v.id)}>Delete</button>
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

          {/* Analytics tab */}
          {tab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Play count chart */}
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>🎧 Plays by Song</h3>
                {songs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No songs uploaded yet.</p>
                ) : (
                  <div className="bar-chart">
                    {[...songs]
                      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
                      .map(s => (
                        <div key={s.id} className="bar-row">
                          <div className="bar-label" title={s.title}>{s.title}</div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${((s.play_count || 0) / maxPlays) * 100}%` }} />
                          </div>
                          <div className="bar-value">{(s.play_count || 0).toLocaleString()}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Sales & Earnings */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3>💰 Sales & Earnings</h3>
                  <span className={`badge ${stripeStatus.payoutsEnabled ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: '0.75rem' }}>
                    {stripeStatus.payoutsEnabled ? 'Stripe Payouts Enabled' : 'Stripe Payouts Pending'}
                  </span>
                </div>
                <div className="stats-row" style={{ marginBottom: '1.25rem' }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--success)' }}>${totalRevenue.toFixed(2)}</div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{totalSales}</div>
                    <div className="stat-label">Sales</div>
                  </div>
                </div>
                {purchasesBySong.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    No sales yet. Set a price on your songs to start earning.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {purchasesBySong.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--surface-2)', borderRadius: 8 }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-h)', fontSize: '0.875rem' }}>{p.title}</span>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{p.count} sale{p.count !== 1 ? 's' : ''}</span>
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>${p.revenue.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  💳 Gross sales are tracked here. Stripe fees and platform splits are saved at checkout and applied during payout processing.
                </div>
              </div>

              {/* Recent Comments */}
              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>💬 Recent Comments</h3>
                {recentComments.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No comments on your songs yet. Share your music to get feedback!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recentComments.map(c => (
                      <div key={c.id} style={{ padding: '0.875rem', background: 'var(--surface-2)', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                          On <span style={{ color: 'var(--accent)' }}>{c.songTitle}</span>
                          {' · '}
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-h)', lineHeight: 1.5 }}>{c.comment}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contest Entries */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3>🏆 Contest Entries</h3>
                  <Link to="/contests" className="btn btn-outline btn-sm">Browse Contests</Link>
                </div>
                {contestEntries.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    You haven't entered any contests yet. Contests are a great way to get discovered.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {contestEntries.map((c, i) => (
                      <div key={c?.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--surface-2)', borderRadius: 8 }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-h)', fontSize: '0.9rem' }}>{c.title}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className={`badge ${c.status === 'active' ? 'badge-active' : 'badge-pending'}`}>{c.status}</span>
                          {c.id && <Link to={`/contests/${c.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>View →</Link>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}
    </div>
  )
}
