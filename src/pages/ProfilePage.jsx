import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    const { error } = await updateProfile(form)
    setLoading(false)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setStatus({ type: 'success', msg: 'Profile updated!' })
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1>Your Profile</h1>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--surface-2)', border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', overflow: 'hidden', flexShrink: 0,
          }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : '👤'}
          </div>
          <div>
            <h2 style={{ marginBottom: '0.25rem' }}>{profile?.display_name || user?.email}</h2>
            <span className={`badge badge-${profile?.role || 'fan'}`}>{profile?.role || 'fan'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text)' }}>
          <div><strong style={{ color: 'var(--text-h)' }}>Email:</strong> {user?.email}</div>
          <div><strong style={{ color: 'var(--text-h)' }}>Member since:</strong> {new Date(profile?.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Edit Profile</h2>

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'error' : 'success'}`}>
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Display Name</label>
            <input
              className="input"
              type="text"
              value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
              placeholder="Your display name"
            />
          </div>
          <div className="form-group">
            <label>Avatar URL</label>
            <input
              className="input"
              type="url"
              value={form.avatar_url}
              onChange={e => setForm({ ...form, avatar_url: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
