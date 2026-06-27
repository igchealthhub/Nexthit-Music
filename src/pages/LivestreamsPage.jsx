import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = { live: 'badge-active', scheduled: 'badge-pending', ended: 'badge-fan' }
const STATUS_ICONS  = { live: '🔴', scheduled: '⏰', ended: '✅' }

export default function LivestreamsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [streams, setStreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [tipModal, setTipModal] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', scheduled_at: '', stream_url: '' })
  const [creating, setCreating] = useState(false)
  const [tipForm, setTipForm] = useState({ amount: '', message: '' })
  const [tipping, setTipping] = useState(false)
  const [tipSent, setTipSent] = useState(false)

  const isArtist = profile?.role === 'artist' || profile?.is_admin

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('livestreams')
      .select('*, profiles!artist_id(id, display_name, avatar_url, verified)')
      .order('scheduled_at', { ascending: false })
      .limit(50)
    setStreams(data || [])
    setLoading(false)
  }

  async function createStream(e) {
    e.preventDefault()
    if (!user || creating) return
    setCreating(true)
    const { data, error } = await supabase.from('livestreams').insert({
      artist_id: user.id,
      title: form.title,
      description: form.description || null,
      scheduled_at: form.scheduled_at || null,
      stream_url: form.stream_url || null,
      status: 'scheduled',
    }).select('*, profiles!artist_id(id, display_name, avatar_url, verified)').single()
    if (error) { alert(error.message); setCreating(false); return }
    setStreams(prev => [data, ...prev])
    setForm({ title: '', description: '', scheduled_at: '', stream_url: '' })
    setShowCreate(false)
    setCreating(false)
  }

  async function goLive(id) {
    await supabase.from('livestreams').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', id)
    setStreams(prev => prev.map(s => s.id === id ? { ...s, status: 'live' } : s))
  }

  async function endStream(id) {
    await supabase.from('livestreams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id)
    setStreams(prev => prev.map(s => s.id === id ? { ...s, status: 'ended' } : s))
  }

  async function sendTip(e) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (!tipModal || tipping || !tipForm.amount) return
    setTipping(true)
    const { error } = await supabase.from('tips').insert({
      sender_id: user.id,
      recipient_id: tipModal.artist_id,
      livestream_id: tipModal.id,
      amount: Number(tipForm.amount),
      message: tipForm.message || null,
    })
    if (error && error.code !== '23505') { alert(error.message); setTipping(false); return }
    setTipSent(true)
    setTipping(false)
    setTimeout(() => { setTipModal(null); setTipSent(false); setTipForm({ amount: '', message: '' }) }, 2000)
  }

  const filtered = filter === 'all' ? streams : streams.filter(s => s.status === filter)

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🎙️ Livestreams</h1>
          <p>Watch live concerts and support artists with tips</p>
        </div>
        {isArtist && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Schedule Stream</button>
        )}
      </div>

      {/* Create stream form */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent)' }}>
          <h3 style={{ marginBottom: '1rem' }}>📅 Schedule a Livestream</h3>
          <form onSubmit={createStream}>
            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Title *</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="My Live Show" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Scheduled Date & Time</label>
                <input className="input" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Description</label>
              <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What will you be playing?" rows={2} style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label>Stream URL (YouTube / Twitch link)</label>
              <input className="input" type="url" value={form.stream_url} onChange={e => setForm({ ...form, stream_url: e.target.value })} placeholder="https://youtube.com/live/..." />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" type="submit" disabled={creating}>{creating ? 'Scheduling…' : 'Schedule Stream'}</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'live', label: '🔴 Live Now' },
          { key: 'scheduled', label: '⏰ Upcoming' },
          { key: 'ended', label: 'Past' },
        ].map(f => (
          <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎙️</div>
          <h3>{filter === 'live' ? 'No one is live right now' : filter === 'scheduled' ? 'No upcoming streams' : 'No streams yet'}</h3>
          <p>{isArtist ? 'Schedule your first live show to connect with fans.' : 'Check back soon — artists will be streaming here.'}</p>
          {isArtist && <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={() => setShowCreate(true)}>Schedule a Stream</button>}
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map(s => {
            const artist = s.profiles
            const isOwner = user?.id === s.artist_id
            return (
              <div key={s.id} className="card" style={{ borderColor: s.status === 'live' ? 'var(--success)' : 'var(--border)', position: 'relative' }}>
                {s.status === 'live' && (
                  <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#ef4444', color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 20 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                    LIVE
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, overflow: 'hidden' }}>
                    {artist?.avatar_url ? <img src={artist.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '🎤'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {artist?.display_name || 'Artist'}
                      {artist?.verified && <span style={{ color: '#60a5fa', fontSize: '0.875rem' }}>✓</span>}
                    </div>
                    <span className={`badge ${STATUS_COLORS[s.status] || 'badge-pending'}`} style={{ fontSize: '0.7rem' }}>
                      {STATUS_ICONS[s.status]} {s.status}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.0625rem', marginBottom: '0.5rem' }}>{s.title}</h3>
                {s.description && <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6, marginBottom: '0.75rem' }}>{s.description}</p>}

                {s.scheduled_at && s.status === 'scheduled' && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                    📅 {new Date(s.scheduled_at).toLocaleString()}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  {s.stream_url && s.status === 'live' && (
                    <a href={s.stream_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">🎙️ Watch Live</a>
                  )}
                  {user && !isOwner && (
                    <button className="btn btn-outline btn-sm" onClick={() => { setTipModal(s); setTipSent(false) }} style={{ color: 'var(--accent-2)', borderColor: 'var(--accent-2)' }}>
                      💸 Tip Artist
                    </button>
                  )}
                  {isOwner && s.status === 'scheduled' && (
                    <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => goLive(s.id)}>Go Live 🔴</button>
                  )}
                  {isOwner && s.status === 'live' && (
                    <button className="btn btn-outline btn-sm" onClick={() => endStream(s.id)}>End Stream</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tip modal */}
      {tipModal && (
        <div className="modal-overlay" onClick={() => setTipModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>💸 Tip {tipModal.profiles?.display_name || 'Artist'}</h2>
              <button className="btn btn-ghost" onClick={() => setTipModal(null)}>✕</button>
            </div>

            {!user ? (
              <div className="alert alert-info">Please <a href="/login" style={{ color: 'var(--accent)' }}>log in</a> to send a tip.</div>
            ) : tipSent ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
                <h3>Tip Sent!</h3>
                <p style={{ color: 'var(--text)', marginTop: '0.5rem' }}>Your support means everything to the artist.</p>
              </div>
            ) : (
              <form onSubmit={sendTip}>
                <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6 }}>
                  💳 <strong>Payment processing coming soon.</strong> Your tip will be recorded and paid out when Stripe Connect launches.
                </div>
                <div className="form-group">
                  <label>Tip Amount ($) *</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    value={tipForm.amount}
                    onChange={e => setTipForm({ ...tipForm, amount: e.target.value })}
                    placeholder="5"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Message (optional)</label>
                  <input
                    className="input"
                    value={tipForm.message}
                    onChange={e => setTipForm({ ...tipForm, message: e.target.value })}
                    placeholder="You're amazing! 🙌"
                    maxLength={200}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-primary" type="submit" disabled={tipping || !tipForm.amount} style={{ flex: 1 }}>
                    {tipping ? 'Sending…' : `Send $${tipForm.amount || '0'} Tip`}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setTipModal(null)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
