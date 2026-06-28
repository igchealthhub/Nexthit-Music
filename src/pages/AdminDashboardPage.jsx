import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const STATUS_MAP = {
  pending:   'badge-pending',
  approved:  'badge-active',
  rejected:  'badge-admin',
  draft:     'badge-fan',
  active:    'badge-active',
  voting:    'badge-pending',
  closed:    'badge-fan',
}

export default function AdminDashboardPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('pending')
  const [songs, setSongs] = useState([])
  const [pendingSongs, setPendingSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [pendingVideos, setPendingVideos] = useState([])
  const [users, setUsers] = useState([])
  const [contests, setContests] = useState([])
  const [contestEntries, setContestEntries] = useState([])
  const [contestManagerError, setContestManagerError] = useState('')
  const [creatingContest, setCreatingContest] = useState(false)
  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    prize: '',
    category: '',
    start_date: '',
    end_date: '',
    entry_deadline: '',
    voting_deadline: '',
    rules: '',
    status: 'draft',
  })
  const [userStats, setUserStats] = useState({ total: 0, artists: 0, fans: 0, admins: 0 })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setFetchError('')
    setDebugInfo(null)

    const statusFilter = 'pending'
    const sessionResult = await supabase.auth.getSession()
    const sessionUserId = sessionResult.data?.session?.user?.id
    const sessionError = sessionResult.error

    console.log('[AdminDashboard] auth session check', {
      authUserId: user?.id,
      profileIsAdmin: profile?.is_admin,
      sessionUserId,
      sessionError,
    })

    const [s, v, p, c, pendingSongRes, pendingVideoRes] = await Promise.all([
      supabase.from('songs').select('*').order('created_at', { ascending: false }),
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name, email, role, is_admin, verified, created_at').order('created_at', { ascending: false }),
      supabase.from('contests').select('*').order('created_at', { ascending: false }),
      supabase.from('songs').select('*').eq('status', statusFilter).order('created_at', { ascending: false }),
      supabase.from('videos').select('*').eq('status', statusFilter).order('created_at', { ascending: false }),
    ])

    const errors = []
    if (s.error) {
      console.error('[AdminDashboard] songs query failed', { query: "supabase.from('songs').select('*').order('created_at', { ascending: false })", error: s.error })
      errors.push(`Songs: ${s.error.message} (code: ${s.error.code})`)
    }
    if (v.error) {
      console.error('[AdminDashboard] videos query failed', { query: "supabase.from('videos').select('*').order('created_at', { ascending: false })", error: v.error })
      errors.push(`Videos: ${v.error.message} (code: ${v.error.code})`)
    }
    if (pendingSongRes.error) {
      console.error('[AdminDashboard] pending songs query failed', { query: "supabase.from('songs').select('*').eq('status', statusFilter).order('created_at', { ascending: false })", error: pendingSongRes.error })
      errors.push(`Pending songs: ${pendingSongRes.error.message} (code: ${pendingSongRes.error.code})`)
    }
    if (pendingVideoRes.error) {
      console.error('[AdminDashboard] pending videos query failed', { query: "supabase.from('videos').select('*').eq('status', statusFilter).order('created_at', { ascending: false })", error: pendingVideoRes.error })
      errors.push(`Pending videos: ${pendingVideoRes.error.message} (code: ${pendingVideoRes.error.code})`)
    }
    if (errors.length) setFetchError(errors.join(' | '))

    setSongs(s.data ?? [])
    setPendingSongs(pendingSongRes.data ?? [])
    setVideos(v.data ?? [])
    setPendingVideos(pendingVideoRes.data ?? [])

    const allUsers = p.data ?? []
    setUsers(allUsers)
    setUserStats({
      total:   allUsers.length,
      artists: allUsers.filter(u => u.role === 'artist').length,
      fans:    allUsers.filter(u => u.role === 'fan').length,
      admins:  allUsers.filter(u => u.is_admin).length,
    })

    const contestsData = c.data ?? []
    setContests(contestsData)

    const contestIds = contestsData.map(contest => contest.id)
    if (contestIds.length) {
      const entriesRes = await supabase
        .from('contest_entries')
        .select('id, contest_id, artist_id, song_id, created_at, songs(id, title), contest_votes(id)')
        .in('contest_id', contestIds)

      if (entriesRes.error) {
        console.error('[AdminDashboard] contest entries query failed', entriesRes.error)
        setContestManagerError(entriesRes.error.message)
        setContestEntries([])
      } else {
        setContestEntries(entriesRes.data ?? [])
      }
    } else {
      setContestEntries([])
    }
    setDebugInfo({
      statusFilter,
      authUserId: user?.id ?? null,
      profileIsAdmin: profile?.is_admin ?? null,
      sessionUserId,
      sessionError: sessionError?.message ?? null,
      pendingQueryRows: pendingSongRes.data?.length ?? 0,
      pendingQueryError: pendingSongRes.error?.message ?? null,
      pendingQueryResult: pendingSongRes.data ?? null,
    })

    setLoading(false)
  }

  async function loadPendingSongs() {
    setFetchError('')
    const statusFilter = 'pending'
    const sessionResult = await supabase.auth.getSession()
    const sessionUserId = sessionResult.data?.session?.user?.id
    const sessionError = sessionResult.error

    const pendingRes = await supabase
      .from('songs')
      .select('*, genres(name)')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })

    const errorMessage = pendingRes.error
      ? `Pending songs: ${pendingRes.error.message} (code: ${pendingRes.error.code})`
      : ''

    if (errorMessage) setFetchError(prev => prev ? `${prev} | ${errorMessage}` : errorMessage)
    setPendingSongs(pendingRes.data ?? [])

    setDebugInfo({
      statusFilter,
      authUserId: user?.id ?? null,
      profileIsAdmin: profile?.is_admin ?? null,
      sessionUserId,
      sessionError: sessionError?.message ?? null,
      pendingQueryRows: pendingRes.data?.length ?? 0,
      pendingQueryError: pendingRes.error?.message ?? null,
      pendingQueryResult: pendingRes.data ?? null,
    })
  }

  async function updateSongStatus(id, status) {
    const { data, error } = await supabase
      .from('songs')
      .update({ status })
      .eq('id', id)
      .select()

    console.log('UPDATE RESULT:', data)
    console.log('UPDATE ERROR:', error)

    if (error) {
      alert(`Update failed: ${error.message}`)
      return
    }

    if (!data || !data.length) {
      alert('No song was updated.')
      return
    }

    await loadAll()
  }

  async function updateVideoStatus(id, status) {
    const { error } = await supabase.from('videos').update({ status }).eq('id', id)
    if (error) { alert(`Update failed: ${error.message}`); return }
    setVideos(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  async function updateContestStatus(id, status) {
    const { error } = await supabase.from('contests').update({ status }).eq('id', id)
    if (error) { alert(`Update failed: ${error.message}`); return }
    setContests(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  async function createContest(e) {
    e.preventDefault()
    setContestManagerError('')

    if (!contestForm.title.trim()) {
      setContestManagerError('Contest title is required.')
      return
    }

    setCreatingContest(true)

    const payload = {
      title: contestForm.title.trim(),
      description: contestForm.description.trim() || null,
      prize: contestForm.prize.trim() || null,
      category: contestForm.category.trim() || null,
      start_date: contestForm.start_date || null,
      end_date: contestForm.end_date || null,
      entry_deadline: contestForm.entry_deadline || null,
      voting_deadline: contestForm.voting_deadline || null,
      rules: contestForm.rules.trim() || null,
      status: contestForm.status || 'draft',
      created_by: user?.id || null,
    }

    const { data, error } = await supabase
      .from('contests')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      setContestManagerError(`Could not create contest: ${error.message}`)
      setCreatingContest(false)
      return
    }

    if (payload.status === 'active') {
      const { data: artists } = await supabase.from('profiles').select('id').eq('role', 'artist')
      if (artists?.length) {
        await supabase.from('notifications').insert(
          artists.map(artist => ({
            user_id: artist.id,
            type: 'general',
            title: 'New contest open for entries',
            body: `${payload.title} is now open. Submit your song before the deadline.`,
            link: `/contests/${data.id}`,
            read: false,
          }))
        )
      }
    }

    setContestForm({
      title: '',
      description: '',
      prize: '',
      category: '',
      start_date: '',
      end_date: '',
      entry_deadline: '',
      voting_deadline: '',
      rules: '',
      status: 'draft',
    })
    setCreatingContest(false)
    await loadAll()
  }

  async function deleteContest(id) {
    if (!confirm('Delete this contest and its entries?')) return
    const { error } = await supabase.from('contests').delete().eq('id', id)
    if (error) {
      setContestManagerError(`Delete failed: ${error.message}`)
      return
    }
    await loadAll()
  }

  async function markWinner(contestId, entry) {
    setContestManagerError('')
    const { error } = await supabase
      .from('contests')
      .update({ winner_entry_id: entry.id, winner_song_id: entry.song_id, winner_artist_id: entry.artist_id, status: 'closed' })
      .eq('id', contestId)

    if (error) {
      setContestManagerError(`Could not mark winner: ${error.message}`)
      return
    }

    await supabase.from('notifications').insert({
      user_id: entry.artist_id,
      type: 'general',
      title: 'You won a contest!',
      body: `Congratulations! Your entry won this contest.`,
      link: `/contests/${contestId}`,
      read: false,
    })

    await loadAll()
  }

  async function toggleVerified(id, current) {
    const { error } = await supabase.from('profiles').update({ verified: !current }).eq('id', id)
    if (error) { alert(error.message); return }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, verified: !current } : u))
  }

  async function deleteItem(table, id, setState) {
    if (!confirm('Permanently delete?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setState(prev => prev.filter(x => x.id !== id))
  }

  const pending       = pendingSongs
  const approved      = songs.filter(s => s.status === 'approved')
  const rejected      = songs.filter(s => s.status === 'rejected')
  const pendingVideoItems = videos.filter(v => v.status === 'pending')
  const totalPlays    = songs.reduce((sum, s) => sum + (s.play_count || 0), 0)

  const tabSongs =
    tab === 'pending'  ? pending  :
    tab === 'approved' ? approved :
    tab === 'rejected' ? rejected :
    songs

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚙️ Admin Dashboard</h1>
        <p>Review submissions, moderate content, and manage the platform</p>
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          <strong>⚠️ Database error — check RLS policies:</strong><br />
          {fetchError}<br /><br />
          Run the SQL policies in Supabase → SQL Editor, then{' '}
          <button
            style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
            onClick={loadAll}
          >retry</button>.
        </div>
      )}

      {debugInfo && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          <strong>Admin debug:</strong><br />
          statusFilter = <code>{debugInfo.statusFilter}</code><br />
          authUserId = <code>{debugInfo.authUserId ?? 'null'}</code><br />
          profile.is_admin = <code>{String(debugInfo.profileIsAdmin)}</code><br />
          sessionUserId = <code>{debugInfo.sessionUserId ?? 'null'}</code><br />
          sessionError = <code>{debugInfo.sessionError ?? 'none'}</code><br />
          pendingQueryRows = <code>{debugInfo.pendingQueryRows}</code><br />
          pendingQueryError = <code>{debugInfo.pendingQueryError ?? 'none'}</code>
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          {/* Content stats */}
          <div className="stats-row">
            <div className="stat-card" style={{ borderColor: pending.length ? 'var(--warning)' : 'var(--border)' }}>
              <div className="stat-value" style={{ color: pending.length ? 'var(--warning)' : 'var(--text-h)' }}>{pending.length}</div>
              <div className="stat-label">Pending Songs</div>
            </div>
            <div className="stat-card" style={{ borderColor: pendingVideoItems.length ? 'var(--warning)' : 'var(--border)' }}>
              <div className="stat-value" style={{ color: pendingVideoItems.length ? 'var(--warning)' : 'var(--text-h)' }}>{pendingVideoItems.length}</div>
              <div className="stat-label">Pending Videos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{approved.length}</div>
              <div className="stat-label">Approved Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{songs.length}</div>
              <div className="stat-label">Total Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{videos.length}</div>
              <div className="stat-label">Total Videos</div>
            </div>
          </div>

          {/* User stats */}
          <div className="stats-row" style={{ marginBottom: '2rem' }}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{userStats.total}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#d8b4fe' }}>{userStats.artists}</div>
              <div className="stat-label">Artists</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#93c5fd' }}>{userStats.fans}</div>
              <div className="stat-label">Fans</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#fca5a5' }}>{userStats.admins}</div>
              <div className="stat-label">Admins</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalPlays.toLocaleString()}</div>
              <div className="stat-label">Total Plays</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'pending',  label: `⏳ Pending (${pending.length})`    },
              { key: 'approved', label: `✅ Approved (${approved.length})`  },
              { key: 'rejected', label: `❌ Rejected (${rejected.length})`  },
              { key: 'all',      label: `🎵 All Songs (${songs.length})`    },
              { key: 'videos',   label: `🎬 Videos (${videos.length})`      },
              { key: 'users',    label: `👥 Users (${userStats.total})`     },
              { key: 'contests', label: `🏆 Contests (${contests.length})`  },
            ].map(t => (
              <button key={t.key}
                className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTab(t.key)}
              >{t.label}</button>
            ))}
            <button className="btn btn-sm btn-ghost" onClick={loadAll}>↺ Refresh</button>
            <button className="btn btn-sm btn-ghost" onClick={loadPendingSongs}>🧪 Refresh Pending</button>
          </div>

          {/* Song tabs */}
          {(tab === 'pending' || tab === 'approved' || tab === 'rejected' || tab === 'all') && (
            <SongTable
              songs={tabSongs}
              showApprove={tab !== 'approved'}
              showReject={tab !== 'rejected'}
              onApprove={id => updateSongStatus(id, 'approved')}
              onReject={id => updateSongStatus(id, 'rejected')}
              onDelete={id => deleteItem('songs', id, setSongs)}
            />
          )}

          {tab === 'videos' && (
            <VideoTable
              videos={videos}
              onStatus={updateVideoStatus}
              onDelete={id => deleteItem('videos', id, setVideos)}
            />
          )}

          {tab === 'users' && <UsersTable users={users} onVerify={toggleVerified} />}

          {tab === 'contests' && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {contestManagerError && (
                <div className="alert alert-error">{contestManagerError}</div>
              )}

              <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Create Contest</h3>
                <form onSubmit={createContest}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label>Title *</label>
                      <input
                        className="input"
                        value={contestForm.title}
                        onChange={e => setContestForm(prev => ({ ...prev, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <input
                        className="input"
                        value={contestForm.category}
                        onChange={e => setContestForm(prev => ({ ...prev, category: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Prize</label>
                      <input
                        className="input"
                        value={contestForm.prize}
                        onChange={e => setContestForm(prev => ({ ...prev, prize: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select
                        className="input"
                        value={contestForm.status}
                        onChange={e => setContestForm(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="voting">voting</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Start Date</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={contestForm.start_date}
                        onChange={e => setContestForm(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={contestForm.end_date}
                        onChange={e => setContestForm(prev => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Entry Deadline</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={contestForm.entry_deadline}
                        onChange={e => setContestForm(prev => ({ ...prev, entry_deadline: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Voting Deadline</label>
                      <input
                        className="input"
                        type="datetime-local"
                        value={contestForm.voting_deadline}
                        onChange={e => setContestForm(prev => ({ ...prev, voting_deadline: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      className="input"
                      value={contestForm.description}
                      onChange={e => setContestForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Rules</label>
                    <textarea
                      className="input"
                      value={contestForm.rules}
                      onChange={e => setContestForm(prev => ({ ...prev, rules: e.target.value }))}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={creatingContest}>
                    {creatingContest ? 'Creating…' : 'Create Contest'}
                  </button>
                </form>
              </div>

              <ContestsTable
                contests={contests}
                entries={contestEntries}
                onStatus={updateContestStatus}
                onDelete={deleteContest}
                onMarkWinner={markWinner}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SongTable({ songs, showApprove, showReject, onApprove, onReject, onDelete }) {
  if (!songs.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h3>No songs in this category</h3>
        <p>If you expect songs here, check that RLS policies are applied in Supabase.</p>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Title</th><th>Genre</th><th>Plays</th><th>Status</th><th>Submitted</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {songs.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>{s.title}</div>
                  {s.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {s.description.slice(0, 60)}{s.description.length > 60 ? '…' : ''}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: '0.875rem' }}>{s.genres?.name || '—'}</td>
                <td>{s.play_count ?? 0}</td>
                <td><span className={`badge ${STATUS_MAP[s.status] || 'badge-pending'}`}>{s.status}</span></td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {showApprove && s.status !== 'approved' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => onApprove(s.id)}>✅ Approve</button>
                    )}
                    {showReject && s.status !== 'rejected' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }} onClick={() => onReject(s.id)}>❌ Reject</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => onDelete(s.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VideoTable({ videos, onStatus, onDelete }) {
  if (!videos.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎬</div>
        <h3>No videos yet</h3>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Status</th><th>Uploaded</th><th>Actions</th></tr></thead>
          <tbody>
            {videos.map(v => (
              <tr key={v.id}>
                <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>{v.title}</td>
                <td><span className={`badge ${STATUS_MAP[v.status] || 'badge-pending'}`}>{v.status}</span></td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {new Date(v.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {v.status !== 'approved' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => onStatus(v.id, 'approved')}>✅ Approve</button>
                    )}
                    {v.status === 'approved' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onStatus(v.id, 'pending')}>Unpublish</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => onDelete(v.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UsersTable({ users, onVerify }) {
  if (!users.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <h3>No users found</h3>
        <p>Users will appear here once they sign up. Check that the profiles SELECT policy is applied.</p>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Admin</th><th>Verified</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>
                  {u.display_name || '—'}
                  {u.verified && <span style={{ color: '#60a5fa', marginLeft: '0.375rem', fontSize: '0.875rem' }}>✓</span>}
                </td>
                <td style={{ fontSize: '0.875rem' }}>{u.email}</td>
                <td><span className={`badge badge-${u.role || 'fan'}`}>{u.role || 'fan'}</span></td>
                <td>
                  {u.is_admin
                    ? <span className="badge badge-admin">Yes</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>—</span>}
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${u.verified ? 'btn-outline' : 'btn-ghost'}`}
                    style={u.verified ? { color: '#60a5fa', borderColor: '#60a5fa', fontSize: '0.75rem' } : { fontSize: '0.75rem' }}
                    onClick={() => onVerify(u.id, u.verified)}
                  >
                    {u.verified ? '✓ Verified' : 'Verify'}
                  </button>
                </td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ContestsTable({ contests, entries, onStatus, onDelete, onMarkWinner }) {
  if (!contests.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏆</div>
        <h3>No contests yet</h3>
        <p>Create contests to drive engagement from fans and artists.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {contests.map(c => {
        const contestRows = entries.filter(entry => entry.contest_id === c.id)
        const totalVotes = contestRows.reduce((sum, row) => sum + (row.contest_votes?.length || 0), 0)
        const sortedEntries = [...contestRows].sort((a, b) => (b.contest_votes?.length || 0) - (a.contest_votes?.length || 0))

        return (
          <div key={c.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: '1rem' }}>{c.title}</div>
                {c.description && <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{c.description}</div>}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className={`badge ${STATUS_MAP[c.status] || 'badge-pending'}`}>{c.status}</span>
                  <span className="badge badge-fan">Entries: {contestRows.length}</span>
                  <span className="badge badge-fan">Votes: {totalVotes}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {['draft', 'active', 'voting', 'closed'].map(status => (
                  <button
                    key={status}
                    className="btn btn-sm btn-outline"
                    disabled={c.status === status}
                    onClick={() => onStatus(c.id, status)}
                  >
                    {status}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => onDelete(c.id)}>Delete</button>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Entries</div>
              {sortedEntries.length === 0 ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No entries yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {sortedEntries.map(entry => {
                    const votes = entry.contest_votes?.length || 0
                    return (
                      <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.625rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{entry.songs?.title || 'Untitled song'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Votes: {votes}</div>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={() => onMarkWinner(c.id, entry)}>
                          Mark Winner
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
