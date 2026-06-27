import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = { active: 'badge-active', upcoming: 'badge-pending', closed: 'badge-fan' }

export default function ContestDetailPage() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [contest, setContest] = useState(null)
  const [entries, setEntries] = useState([])
  const [myVote, setMyVote] = useState(null)
  const [myEntry, setMyEntry] = useState(null)
  const [artistSongs, setArtistSongs] = useState([])
  const [selectedSong, setSelectedSong] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [entering, setEntering] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const isArtist = profile?.role === 'artist' || profile?.is_admin

  useEffect(() => { load() }, [id, user?.id])

  async function load() {
    setLoading(true)

    const [contestRes, entriesRes] = await Promise.all([
      supabase.from('contests').select('*').eq('id', id).maybeSingle(),
      supabase.from('contest_entries')
        .select('id, song_id, artist_id, created_at, songs(id, title, cover_url, play_count, genres(name)), contest_votes(id, user_id)')
        .eq('contest_id', id),
    ])

    if (!contestRes.data) { setNotFound(true); setLoading(false); return }
    setContest(contestRes.data)

    const sorted = (entriesRes.data || []).sort((a, b) => (b.contest_votes?.length || 0) - (a.contest_votes?.length || 0))
    setEntries(sorted)

    if (user) {
      const [voteRes, entryRes] = await Promise.all([
        supabase.from('contest_votes').select('entry_id').eq('contest_id', id).eq('user_id', user.id).maybeSingle(),
        isArtist ? supabase.from('contest_entries').select('id, song_id').eq('contest_id', id).eq('artist_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setMyVote(voteRes.data?.entry_id || null)
      setMyEntry(entryRes.data)

      if (isArtist) {
        const { data: songs } = await supabase.from('songs').select('id, title').eq('artist_id', user.id).eq('status', 'approved').order('created_at', { ascending: false })
        setArtistSongs(songs || [])
      }
    }

    setLoading(false)
  }

  async function handleVote(entryId) {
    if (!user) { navigate('/login'); return }
    if (voting || contest?.status !== 'active') return
    setVoting(true)

    if (myVote === entryId) {
      await supabase.from('contest_votes').delete().eq('contest_id', id).eq('user_id', user.id)
      setMyVote(null)
    } else {
      if (myVote) {
        await supabase.from('contest_votes').delete().eq('contest_id', id).eq('user_id', user.id)
      }
      await supabase.from('contest_votes').insert({ contest_id: id, user_id: user.id, entry_id: entryId })
      setMyVote(entryId)
    }

    await load()
    setVoting(false)
  }

  async function handleEnter(e) {
    e.preventDefault()
    if (!selectedSong || entering) return
    setEntering(true)
    const { data, error } = await supabase.from('contest_entries')
      .insert({ contest_id: id, artist_id: user.id, song_id: selectedSong })
      .select('id, song_id').single()
    if (error) { alert(`Entry failed: ${error.message}`); setEntering(false); return }
    setMyEntry(data)
    setShowEntryForm(false)
    setSelectedSong('')
    setEntering(false)
    await load()
  }

  async function handleWithdraw() {
    if (!myEntry || !confirm('Withdraw your entry from this contest?')) return
    await supabase.from('contest_entries').delete().eq('id', myEntry.id)
    setMyEntry(null)
    await load()
  }

  const rankLabel = i => {
    if (i === 0) return { label: '🥇', cls: 'top-1' }
    if (i === 1) return { label: '🥈', cls: 'top-2' }
    if (i === 2) return { label: '🥉', cls: 'top-3' }
    return { label: `#${i + 1}`, cls: '' }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  if (notFound) return (
    <div className="page" style={{ maxWidth: 600, textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
      <h1>Contest Not Found</h1>
      <p style={{ margin: '1rem 0 2rem', color: 'var(--text)' }}>This contest doesn't exist or has been removed.</p>
      <Link to="/contests" className="btn btn-primary">Browse Contests</Link>
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ marginBottom: '0.5rem' }}>
            <Link to="/contests" className="btn btn-ghost btn-sm" style={{ padding: '0.25rem 0.5rem', marginLeft: '-0.5rem' }}>← Contests</Link>
          </div>
          <h1>{contest.title}</h1>
          {contest.description && <p style={{ color: 'var(--text)', marginTop: '0.5rem', maxWidth: 560 }}>{contest.description}</p>}
        </div>
        <span className={`badge ${STATUS_COLORS[contest.status] || 'badge-pending'}`} style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>{contest.status}</span>
      </div>

      {/* Artist entry section */}
      {user && isArtist && contest.status === 'active' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: myEntry ? 'var(--success)' : 'var(--border)' }}>
          {myEntry ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>✅ You've entered this contest</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Your song is in the running. Good luck!</div>
              </div>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }} onClick={handleWithdraw}>Withdraw Entry</button>
            </div>
          ) : showEntryForm ? (
            <form onSubmit={handleEnter}>
              <h3 style={{ marginBottom: '1rem' }}>Enter This Contest</h3>
              <div className="form-group">
                <label>Select a song to enter</label>
                <select className="input" value={selectedSong} onChange={e => setSelectedSong(e.target.value)} required>
                  <option value="">Choose an approved song…</option>
                  {artistSongs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              {artistSongs.length === 0 && (
                <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                  You need at least one approved song to enter. <Link to="/upload/song">Upload a song →</Link>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" type="submit" disabled={entering || !selectedSong}>
                  {entering ? 'Entering…' : 'Submit Entry'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setShowEntryForm(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>🎤 Enter this contest</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Submit one of your approved songs to compete for votes.</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowEntryForm(true)}>Enter Contest</button>
            </div>
          )}
        </div>
      )}

      {/* Voting info */}
      {contest.status === 'active' && user && myVote && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          ✅ You've voted in this contest. You can change your vote by clicking a different entry.
        </div>
      )}
      {contest.status !== 'active' && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          {contest.status === 'upcoming' ? '⏰ Voting opens when this contest goes live.' : '🔒 This contest is closed. Voting has ended.'}
        </div>
      )}

      {/* Entries */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Entries ({entries.length})</h2>
        {contest.status === 'active' && !user && (
          <Link to="/login" className="btn btn-primary btn-sm">Log in to vote</Link>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <h3>No entries yet</h3>
          <p>{isArtist && contest.status === 'active' ? 'Be the first to enter!' : 'Artists haven\'t submitted entries yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map((entry, i) => {
            const voteCount = entry.contest_votes?.length || 0
            const voted = myVote === entry.id
            const isMyEntry = myEntry?.id === entry.id
            const { label, cls } = rankLabel(i)
            const song = entry.songs

            return (
              <div key={entry.id} className="card" style={{ borderColor: voted ? 'var(--accent)' : isMyEntry ? 'var(--success)' : 'var(--border)', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className={`lb-rank ${cls}`} style={{ width: 32, textAlign: 'center', fontWeight: 700, flexShrink: 0 }}>{label}</div>

                  <div style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--surface-2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    {song?.cover_url ? <img src={song.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎵'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '1rem' }}>{song?.title || 'Unknown Song'}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {song?.genres?.name && <span style={{ marginRight: '0.5rem' }}>{song.genres.name}</span>}
                      🎧 {(song?.play_count || 0).toLocaleString()} plays
                    </div>
                    {isMyEntry && <span className="badge badge-active" style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>Your entry</span>}
                  </div>

                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: voted ? 'var(--accent)' : 'var(--text-h)' }}>{voteCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vote{voteCount !== 1 ? 's' : ''}</div>
                  </div>

                  {contest.status === 'active' && user && (
                    <button
                      className={`btn btn-sm ${voted ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => handleVote(entry.id)}
                      disabled={voting}
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
