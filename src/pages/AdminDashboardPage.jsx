import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_MAP = {
  pending:   'badge-pending',
  approved:  'badge-active',
  rejected:  'badge-admin',
  draft:     'badge-fan',
  published: 'badge-active',
  active:    'badge-active',
  upcoming:  'badge-pending',
  closed:    'badge-fan',
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('pending')
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [users, setUsers] = useState([])
  const [contests, setContests] = useState([])
  const [userStats, setUserStats] = useState({ total: 0, artists: 0, fans: 0, admins: 0 })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setFetchError('')

    const [s, v, p, c] = await Promise.all([
      supabase.from('songs').select('*, genres(name)').order('created_at', { ascending: false }),
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name, email, role, is_admin, verified, created_at').order('created_at', { ascending: false }),
      supabase.from('contests').select('*').order('created_at', { ascending: false }),
    ])

    const errors = []
    if (s.error) errors.push(`Songs: ${s.error.message} (code: ${s.error.code})`)
    if (v.error) errors.push(`Videos: ${v.error.message} (code: ${v.error.code})`)
    if (errors.length) setFetchError(errors.join(' | '))

    setSongs(s.data ?? [])
    setVideos(v.data ?? [])

    const allUsers = p.data ?? []
    setUsers(allUsers)
    setUserStats({
      total:   allUsers.length,
      artists: allUsers.filter(u => u.role === 'artist').length,
      fans:    allUsers.filter(u => u.role === 'fan').length,
      admins:  allUsers.filter(u => u.is_admin).length,
    })

    setContests(c.data ?? [])
    setLoading(false)
  }

  async function updateSongStatus(id, status) {
    const { error } = await supabase.from('songs').update({ status }).eq('id', id)
    if (error) { alert(`Update failed: ${error.message}`); return }
    setSongs(prev => prev.map(s => s.id === id ? { ...s, status } : s))
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

  const pending       = songs.filter(s => s.status === 'pending')
  const approved      = songs.filter(s => s.status === 'approved')
  const rejected      = songs.filter(s => s.status === 'rejected')
  const pendingVideos = videos.filter(v => v.status === 'pending')
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
            <div className="stat-card" style={{ borderColor: pendingVideos.length ? 'var(--warning)' : 'var(--border)' }}>
              <div className="stat-value" style={{ color: pendingVideos.length ? 'var(--warning)' : 'var(--text-h)' }}>{pendingVideos.length}</div>
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
            <button className="btn btn-sm btn-ghost" onClick={loadAll} style={{ marginLeft: 'auto' }}>↺ Refresh</button>
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
            <ContestsTable
              contests={contests}
              onStatus={updateContestStatus}
              onDelete={id => deleteItem('contests', id, setContests)}
            />
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

function ContestsTable({ contests, onStatus, onDelete }) {
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
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Title</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {contests.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>{c.title}</div>
                  {c.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {c.description.slice(0, 60)}{c.description.length > 60 ? '…' : ''}
                    </div>
                  )}
                </td>
                <td><span className={`badge ${STATUS_MAP[c.status] || 'badge-pending'}`}>{c.status}</span></td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {c.status !== 'active' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => onStatus(c.id, 'active')}>Activate</button>
                    )}
                    {c.status === 'active' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }} onClick={() => onStatus(c.id, 'closed')}>Close</button>
                    )}
                    {c.status !== 'upcoming' && c.status !== 'active' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onStatus(c.id, 'upcoming')}>Reopen</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => onDelete(c.id)}>Delete</button>
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
