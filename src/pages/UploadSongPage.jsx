import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function UploadSongPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', audio_url: '', cover_url: '', status: 'published' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Title is required.'); return }
    setLoading(true)
    const { error } = await supabase.from('songs').insert({
      artist_id: user.id,
      title: form.title,
      description: form.description,
      audio_url: form.audio_url,
      cover_url: form.cover_url,
      status: form.status,
      play_count: 0,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/artist-dashboard')
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1>Upload Song</h1>
        <p>Share your music with the NextHit community</p>
      </div>

      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Song Title *</label>
            <input className="input" type="text" placeholder="My Amazing Track" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="input" placeholder="Tell listeners about this song…" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Audio URL</label>
            <input className="input" type="url" placeholder="https://…/song.mp3" value={form.audio_url}
              onChange={e => setForm({ ...form, audio_url: e.target.value })} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Direct link to an .mp3 or audio file</span>
          </div>
          <div className="form-group">
            <label>Cover Art URL</label>
            <input className="input" type="url" placeholder="https://…/cover.jpg" value={form.cover_url}
              onChange={e => setForm({ ...form, cover_url: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Uploading…' : 'Upload Song'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
