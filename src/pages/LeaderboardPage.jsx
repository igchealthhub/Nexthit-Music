import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('plays')
  const [songsByPlays, setSongsByPlays] = useState([])
  const [songsByLikes, setSongsByLikes] = useState([])
  const [contestEntries, setContestEntries] = useState([])
  const [activeContest, setActiveContest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [user])

  async function load() {
    if (!user) {
      setSongsByPlays([])
      setSongsByLikes([])
      setContestEntries([])
      setActiveContest(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const [playsRes, likesRes, contestRes] = await Promise.all([
      supabase
        .from('songs')
        .select('id, title, cover_url, play_count, genres(name)')
        .eq('status', 'approved')
        .order('play_count', { ascending: false })
        .limit(20),
      supabase
        .from('likes')
        .select('song_id')
        .in('song_id',
          // We only want likes for approved songs; subquery not supported here, so we fetch all and join
          (await supabase.from('songs').select('id').eq('status', 'approved')).data?.map(s => s.id) || []
        ),
      supabase
        .from('contests')
        .select('id, title')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setSongsByPlays(playsRes.data || [])

    // Build likes count map and sort
    const likeCounts = {}
    ;(likesRes.data || []).forEach(l => { likeCounts[l.song_id] = (likeCounts[l.song_id] || 0) + 1 })
    const songsWithLikes = (playsRes.data || [])
      .map(s => ({ ...s, likeCount: likeCounts[s.id] || 0 }))
      .sort((a, b) => b.likeCount - a.likeCount)
    setSongsByLikes(songsWithLikes)

    if (contestRes.data) {
      setActiveContest(contestRes.data)
      const entriesRes = await supabase
        .from('contest_entries')
        .select('id, song_id, songs(id, title, cover_url, play_count, genres(name)), contest_votes(id)')
        .eq('contest_id', contestRes.data.id)
      const sorted = (entriesRes.data || []).sort((a, b) => (b.contest_votes?.length || 0) - (a.contest_votes?.length || 0))
      setContestEntries(sorted)
    }

    setLoading(false)
  }

  const rankLabel = i => {
    if (i === 0) return { label: '🥇', cls: 'top-1' }
    if (i === 1) return { label: '🥈', cls: 'top-2' }
    if (i === 2) return { label: '🥉', cls: 'top-3' }
    return { label: `#${i + 1}`, cls: '' }
  }

  const TABS = [
    { key: 'plays', label: '🎧 Most Played' },
    { key: 'likes', label: '❤️ Most Liked' },
    { key: 'contest', label: '🏆 Contest Votes' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏆 Leaderboard</h1>
        <p>Top tracks ranked by plays, likes, and contest votes</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : !user ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h3>Log in to view leaderboard details</h3>
          <p>Rankings become available after sign in.</p>
        </div>
      ) : (
        <>
          {/* Most Played */}
          {tab === 'plays' && (
            songsByPlays.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎧</div>
                <h3>No rankings yet</h3>
                <p>Songs will appear here once they get plays.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {songsByPlays.map((song, i) => {
                  const { label, cls } = rankLabel(i)
                  return (
                    <div key={song.id} className="leaderboard-row">
                      <div className={`lb-rank ${cls}`}>{label}</div>
                      <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', fontSize: '1.25rem', overflow: 'hidden' }}>
                        {song.cover_url ? <img src={song.cover_url} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                      </div>
                      <div className="lb-info">
                        <div className="lb-title">{song.title}</div>
                        {song.genres?.name && <div className="lb-sub">{song.genres.name}</div>}
                      </div>
                      <div className="lb-stat">🎧 {(song.play_count || 0).toLocaleString()}</div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Most Liked */}
          {tab === 'likes' && (
            songsByLikes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">❤️</div>
                <h3>No likes yet</h3>
                <p>Songs with the most hearts will appear here.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {songsByLikes.map((song, i) => {
                  const { label, cls } = rankLabel(i)
                  return (
                    <div key={song.id} className="leaderboard-row">
                      <div className={`lb-rank ${cls}`}>{label}</div>
                      <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', fontSize: '1.25rem', overflow: 'hidden' }}>
                        {song.cover_url ? <img src={song.cover_url} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                      </div>
                      <div className="lb-info">
                        <div className="lb-title">{song.title}</div>
                        {song.genres?.name && <div className="lb-sub">{song.genres.name}</div>}
                      </div>
                      <div className="lb-stat">❤️ {song.likeCount.toLocaleString()}</div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Contest Votes */}
          {tab === 'contest' && (
            !activeContest ? (
              <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <h3>No active contest</h3>
                <p>Check back when a contest is live to see the vote standings.</p>
                <Link to="/contests" className="btn btn-outline btn-sm" style={{ marginTop: '1rem' }}>Browse Contests</Link>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.0625rem' }}>{activeContest.title}</h2>
                    <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>Active</span>
                  </div>
                  <Link to={`/contests/${activeContest.id}`} className="btn btn-primary btn-sm">🗳️ Vote →</Link>
                </div>
                {contestEntries.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <div className="empty-icon">🎵</div>
                    <h3>No entries yet</h3>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0 }}>
                    {contestEntries.map((entry, i) => {
                      const { label, cls } = rankLabel(i)
                      const song = entry.songs
                      const voteCount = entry.contest_votes?.length || 0
                      return (
                        <div key={entry.id} className="leaderboard-row">
                          <div className={`lb-rank ${cls}`}>{label}</div>
                          <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', fontSize: '1.25rem', overflow: 'hidden' }}>
                            {song?.cover_url ? <img src={song.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                          </div>
                          <div className="lb-info">
                            <div className="lb-title">{song?.title || 'Unknown Song'}</div>
                            {song?.genres?.name && <div className="lb-sub">{song.genres.name}</div>}
                          </div>
                          <div className="lb-stat">🗳️ {voteCount}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}
