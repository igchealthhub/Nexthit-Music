import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = {
  draft: 'badge-fan',
  active: 'badge-active',
  voting: 'badge-pending',
  closed: 'badge-fan',
}

function isFullUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function countdownLabel(targetDate) {
  if (!targetDate) return 'No deadline set'
  const ms = new Date(targetDate).getTime() - Date.now()
  if (Number.isNaN(ms)) return 'No deadline set'
  if (ms <= 0) return 'Ended'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export default function ContestDetailPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [contest, setContest] = useState(null)
  const [entries, setEntries] = useState([])
  const [artistById, setArtistById] = useState({})
  const [myVote, setMyVote] = useState(null)
  const [myEntry, setMyEntry] = useState(null)
  const [artistSongs, setArtistSongs] = useState([])
  const [selectedSong, setSelectedSong] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [entering, setEntering] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [pageError, setPageError] = useState('')

  const isArtist = profile?.role === 'artist' || profile?.is_admin

  useEffect(() => {
    load()
  }, [id, user?.id, profile?.role, profile?.is_admin])

  async function resolveStorageUrl(value, bucket) {
    if (!value) return null
    if (isFullUrl(value)) return value
    const path = value.startsWith('/') ? value.slice(1) : value
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data?.publicUrl || value
  }

  async function load() {
    if (!isUuid(id)) {
      navigate('/contests', {
        replace: true,
        state: { message: 'That contest link is invalid. Please pick a contest from the list.' },
      })
      return
    }

    setLoading(true)
    setPageError('')

    const [contestRes, entriesRes] = await Promise.all([
      supabase.from('contests').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('contest_entries')
        .select('id, contest_id, song_id, artist_id, created_at, songs(id, title, cover_url, audio_url, play_count, genres(name)), contest_votes(id, user_id)')
        .eq('contest_id', id),
    ])

    if (contestRes.error) {
      setPageError(`Failed to load contest: ${contestRes.error.message}`)
      setLoading(false)
      return
    }

    if (!contestRes.data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setContest(contestRes.data)

    if (entriesRes.error) {
      setPageError(`Failed to load entries: ${entriesRes.error.message}`)
      setEntries([])
    } else {
      const withPlayable = await Promise.all((entriesRes.data || []).map(async entry => {
        const playableCover = await resolveStorageUrl(entry.songs?.cover_url, 'cover-art')
        const playableAudio = await resolveStorageUrl(entry.songs?.audio_url, 'song-files')
        return {
          ...entry,
          songs: entry.songs
            ? { ...entry.songs, playable_cover_url: playableCover, playable_audio_url: playableAudio }
            : entry.songs,
        }
      }))

      const sorted = withPlayable.sort((a, b) => (b.contest_votes?.length || 0) - (a.contest_votes?.length || 0))
      setEntries(sorted)

      const artistIds = [...new Set(sorted.map(e => e.artist_id).filter(Boolean))]
      if (artistIds.length) {
        const { data: artistRows } = await supabase
          .from('profiles')
          .select('id, display_name, verified')
          .in('id', artistIds)

        const map = {}
        ;(artistRows || []).forEach(row => {
          map[row.id] = row
        })
        setArtistById(map)
      } else {
        setArtistById({})
      }
    }

    if (user) {
      const [voteRes, entryRes] = await Promise.all([
        supabase.from('contest_votes').select('id, entry_id').eq('contest_id', id).eq('user_id', user.id).maybeSingle(),
        isArtist
          ? supabase.from('contest_entries').select('id, song_id').eq('contest_id', id).eq('artist_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      setMyVote(voteRes.data?.entry_id || null)
      setMyEntry(entryRes.data || null)

      if (isArtist) {
        const { data: songs, error: songsError } = await supabase
          .from('songs')
          .select('id, title')
          .eq('artist_id', user.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })

        if (songsError) {
          setPageError(prev => prev || `Failed to load your songs: ${songsError.message}`)
        }
        setArtistSongs(songs || [])
      }
    }

    setLoading(false)
  }

  async function handleVote(entryId) {
    if (!user) {
      navigate('/login')
      return
    }
    if (voting) return
    if (!contest || (contest.status !== 'active' && contest.status !== 'voting')) {
      setPageError('Voting is not open for this contest.')
      return
    }
    if (myVote) {
      setPageError('You have already voted in this contest.')
      return
    }

    setVoting(true)
    setPageError('')

    const { error } = await supabase.from('contest_votes').insert({ contest_id: id, user_id: user.id, entry_id: entryId })

    if (error) {
      setPageError(error.message || 'Could not submit vote.')
      setVoting(false)
      return
    }

    setMyVote(entryId)
    await load()
    setVoting(false)
  }

  async function handleEnter(e) {
    e.preventDefault()
    if (!selectedSong || entering || !user) return

    setEntering(true)
    setPageError('')

    if (myEntry) {
      setPageError('Already entered.')
      setEntering(false)
      return
    }

    const duplicateSongCheck = await supabase
      .from('contest_entries')
      .select('id')
      .eq('contest_id', id)
      .eq('song_id', selectedSong)
      .maybeSingle()

    if (duplicateSongCheck.error) {
      setPageError(duplicateSongCheck.error.message)
      setEntering(false)
      return
    }

    if (duplicateSongCheck.data) {
      setPageError('This song is already entered in this contest.')
      setEntering(false)
      return
    }

    const { data, error } = await supabase
      .from('contest_entries')
      .insert({ contest_id: id, artist_id: user.id, song_id: selectedSong })
      .select('id, song_id')
      .single()

    if (error) {
      setPageError(error.message || 'Entry failed.')
      setEntering(false)
      return
    }

    setMyEntry(data)
    setShowEntryForm(false)
    setSelectedSong('')
    setEntering(false)

    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true)
    if (admins?.length) {
      await supabase.from('notifications').insert(
        admins.map(admin => ({
          user_id: admin.id,
          type: 'general',
          title: 'New contest entry submitted',
          body: `${profile?.display_name || 'An artist'} entered ${contest?.title || 'a contest'}.`,
          link: `/contests/${id}`,
          read: false,
        }))
      )
    }

    await load()
  }

  async function handleWithdraw() {
    if (!myEntry || !confirm('Withdraw your entry from this contest?')) return
    const { error } = await supabase.from('contest_entries').delete().eq('id', myEntry.id)
    if (error) {
      setPageError(error.message || 'Could not withdraw entry.')
      return
    }
    setMyEntry(null)
    await load()
  }

  const rankLabel = i => {
    if (i === 0) return { label: '🥇', cls: 'top-1' }
    if (i === 1) return { label: '🥈', cls: 'top-2' }
    if (i === 2) return { label: '🥉', cls: 'top-3' }
    return { label: `#${i + 1}`, cls: '' }
  }

  const countdownTarget = useMemo(() => {
    if (!contest) return null
    if (contest.status === 'active') return contest.entry_deadline || contest.end_date
    if (contest.status === 'voting') return contest.voting_deadline || contest.end_date
    return contest.end_date || contest.voting_deadline || contest.entry_deadline
  }, [contest])

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (notFound) {
    return (
      <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
        <h1>Contest Not Found</h1>
        <p style={{ margin: '1rem 0 2rem', color: 'var(--text)' }}>This contest doesn't exist or has been removed.</p>
        <Link to="/contests" className="btn btn-primary">Browse Contests</Link>
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="page" style={{ maxWidth: 700 }}>
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {pageError || 'Unable to load this contest right now.'}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={load}>Retry</button>
          <Link to="/contests" className="btn btn-outline">Back to Contests</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ marginBottom: '0.5rem' }}>
            <Link to="/contests" className="btn btn-ghost btn-sm" style={{ padding: '0.25rem 0.5rem', marginLeft: '-0.5rem' }}>← Contests</Link>
          </div>
          <h1>{contest.title}</h1>
          {contest.prize && <p style={{ marginTop: '0.375rem' }}>Prize: <strong>{contest.prize}</strong></p>}
          {contest.description && <p style={{ color: 'var(--text)', marginTop: '0.5rem', maxWidth: 620 }}>{contest.description}</p>}
          {contest.rules && (
            <div className="alert alert-info" style={{ marginTop: '0.75rem' }}>
              <strong>Rules:</strong> {contest.rules}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'end' }}>
          <span className={`badge ${STATUS_COLORS[contest.status] || 'badge-pending'}`} style={{ fontSize: '0.8rem' }}>{contest.status}</span>
          <div className="badge badge-fan">Countdown: {countdownLabel(countdownTarget)}</div>
        </div>
      </div>

      {pageError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {pageError}
        </div>
      )}

      {user && isArtist && contest.status === 'active' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: myEntry ? 'var(--success)' : 'var(--border)' }}>
          {myEntry ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>Already entered</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Your song is in the running.</div>
              </div>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={handleWithdraw}>Withdraw Entry</button>
            </div>
          ) : showEntryForm ? (
            <form onSubmit={handleEnter}>
              <h3 style={{ marginBottom: '1rem' }}>Enter This Contest</h3>
              <div className="form-group">
                <label>Select one approved song</label>
                <select className="input" value={selectedSong} onChange={e => setSelectedSong(e.target.value)} required>
                  <option value="">Choose a song…</option>
                  {artistSongs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              {artistSongs.length === 0 && (
                <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                  You need an approved song to enter. <Link to="/upload/song">Upload one</Link>.
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" type="submit" disabled={entering || !selectedSong || artistSongs.length === 0}>
                  {entering ? 'Submitting…' : 'Submit Entry'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowEntryForm(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>🎤 Enter this contest</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Submit one approved song before the entry deadline.</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowEntryForm(true)}>Enter Contest</button>
            </div>
          )}
        </div>
      )}

      {(contest.status === 'active' || contest.status === 'voting') && user && myVote && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          ✅ You have already voted in this contest.
        </div>
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Leaderboard ({entries.length} entries)</h2>
        {contest.status !== 'active' && contest.status !== 'voting' && (
          <span className="badge badge-fan">Voting closed</span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <h3>No entries yet</h3>
          <p>Artists have not submitted entries yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map((entry, i) => {
            const voteCount = entry.contest_votes?.length || 0
            const voted = myVote === entry.id
            const isMyEntry = myEntry?.id === entry.id
            const { label, cls } = rankLabel(i)
            const song = entry.songs
            const artist = artistById[entry.artist_id]

            return (
              <div key={entry.id} className="card" style={{ borderColor: voted ? 'var(--accent)' : isMyEntry ? 'var(--success)' : 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className={`lb-rank ${cls}`} style={{ width: 32, textAlign: 'center', fontWeight: 700, flexShrink: 0 }}>{label}</div>

                  <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--surface-2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    {song?.playable_cover_url ? <img src={song.playable_cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                  </div>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '1rem' }}>{song?.title || 'Unknown Song'}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {artist?.display_name || 'Artist'}
                      {artist?.verified && <span style={{ color: '#60a5fa', marginLeft: 4 }}>✓</span>}
                      {song?.genres?.name && <span style={{ marginLeft: 8 }}>{song.genres.name}</span>}
                    </div>
                    {song?.playable_audio_url && (
                      <audio controls preload="none" src={song.playable_audio_url} style={{ marginTop: '0.5rem', width: '100%', maxWidth: 360 }} />
                    )}
                    {isMyEntry && <span className="badge badge-active" style={{ marginTop: '0.4rem', fontSize: '0.7rem' }}>Your entry</span>}
                  </div>

                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: voted ? 'var(--accent)' : 'var(--text-h)' }}>{voteCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vote{voteCount !== 1 ? 's' : ''}</div>
                  </div>

                  {(contest.status === 'active' || contest.status === 'voting') && user && (
                    <button
                      className={`btn btn-sm ${voted ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => handleVote(entry.id)}
                      disabled={voting || Boolean(myVote)}
                      style={{ flexShrink: 0 }}
                    >
                      {voted ? '✅ Voted' : '🗳️ Vote'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
