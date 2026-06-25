import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_MAP = {
  pending: 'badge-pending',
  approved: 'badge-active',
  rejected: 'badge-admin',
  draft: 'badge-fan',
  published: 'badge-active',
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('pending')
  const [songs, setSongs] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [s, v] = await Promise.all([
      supabase.from('songs').select('*, genres(name)').order('created_at', { ascending: false }),
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
    ])
    setSongs(s.data || [])
    setVideos(v.data || [])
    setLoading(false)
  }

  async function updateSongStatus(id, status) {
    await supabase.from('songs').update({ status }).eq('id', id)
    setSongs(prev => prev.map(s => s.id === id ? { ...s, status } : s))
  }

  async function updateVideoStatus(id, status) {
    await supabase.from('videos').update({ status }).eq('id', id)
    setVideos(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  async function deleteItem(table, id, setState) {
    if (!confirm('Permanently delete?')) return
    await supabase.from(table).delete().eq('id', id)
    setState(prev => prev.filter(x => x.id !== id))
  }

  const pending = songs.filter(s => s.status === 'pending')
  const approved = songs.filter(s => s.status === 'approved')
  const rejected = songs.filter(s => s.status === 'rejected')
  const allSongs = songs

  const stats = {
    pending: pending.length,
    approved: approved.length,
    songs: songs.length,
    videos: videos.length,
  }

  const tabSongs = tab === 'pending' ? pending
    : tab === 'approved' ? approved
    : tab === 'rejected' ? rejected
    : tab === 'videos' ? null
    : allSongs

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚙️ Admin Dashboard</h1>
        <p>Review submissions and moderate content</p>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-card" style={{ borderColor: pending.length ? 'var(--warning)' : 'var(--border)' }}>
              <div className="stat-value" style={{ color: pending.length ? 'var(--warning)' : 'var(--text-h)' }}>{stats.pending}</div>
              <div className="stat-label">Pending Review</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.approved}</div>
              <div className="stat-label">Approved Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.songs}</div>
              <div className="stat-label">Total Songs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.videos}</div>
              <div className="stat-label">Total Videos</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { key: 'pending', label: `⏳ Pending (${pending.length})` },
              { key: 'approved', label: `✅ Approved (${approved.length})` },
              { key: 'rejected', label: `❌ Rejected (${rejected.length})` },
              { key: 'all', label: `🎵 All Songs (${songs.length})` },
              { key: 'videos', label: `🎬 Videos (${videos.length})` },
            ].map(t => (
              <button
                key={t.key}
                className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTab(t.key)}
              >{t.label}</button>
            ))}
          </div>

          {tab === 'videos' ? (
            <VideoTable videos={videos} onStatus={updateVideoStatus} onDelete={(id) => deleteItem('videos', id, setVideos)} />
          ) : (
            <SongTable
              songs={tabSongs}
              showApprove={tab === 'pending' || tab === 'all' || tab === 'rejected'}
              showReject={tab === 'pending' || tab === 'all' || tab === 'approved'}
              onApprove={id => updateSongStatus(id, 'approved')}
              onReject={id => updateSongStatus(id, 'rejected')}
              onDelete={id => deleteItem('songs', id, setSongs)}
            />
          )}
        </>
      )}
    </div>
  )
}

function SongTable({ songs, showApprove, showReject, onApprove, onReject, onDelete }) {
  if (songs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h3>No songs in this category</h3>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Genre</th>
              <th>Plays</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {songs.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>{s.title}</div>
                  {s.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{s.description.slice(0, 60)}{s.description.length > 60 ? '…' : ''}</div>}
                </td>
                <td style={{ fontSize: '0.875rem' }}>{s.genres?.name || '—'}</td>
                <td>{s.play_count ?? 0}</td>
                <td><span className={`badge ${STATUS_MAP[s.status] || 'badge-pending'}`}>{s.status}</span></td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {showApprove && s.status !== 'approved' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}
                        onClick={() => onApprove(s.id)}>✅ Approve</button>
                    )}
                    {showReject && s.status !== 'rejected' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                        onClick={() => onReject(s.id)}>❌ Reject</button>
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
  if (videos.length === 0) {
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
          <thead>
            <tr><th>Title</th><th>Status</th><th>Uploaded</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {videos.map(v => (
              <tr key={v.id}>
                <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>{v.title}</td>
                <td><span className={`badge ${STATUS_MAP[v.status] || 'badge-pending'}`}>{v.status}</span></td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {v.status !== 'approved' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}
                        onClick={() => onStatus(v.id, 'approved')}>✅ Approve</button>
                    )}
                    {v.status === 'approved' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onStatus(v.id, 'draft')}>Unpublish</button>
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
