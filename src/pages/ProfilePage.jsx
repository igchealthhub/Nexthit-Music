import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()
  const [form, setForm] = useState({
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
    bio: profile?.bio || '',
    social_links: {
      instagram: profile?.social_links?.instagram || '',
      twitter: profile?.social_links?.twitter || '',
      spotify: profile?.social_links?.spotify || '',
      website: profile?.social_links?.website || '',
    },
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setForm({
      display_name: profile?.display_name || '',
      avatar_url: profile?.avatar_url || '',
      bio: profile?.bio || '',
      social_links: {
        instagram: profile?.social_links?.instagram || '',
        twitter: profile?.social_links?.twitter || '',
        spotify: profile?.social_links?.spotify || '',
        website: profile?.social_links?.website || '',
      },
    })
  }, [profile])

  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'

  function setSocial(key, val) {
    setForm(f => ({ ...f, social_links: { ...f.social_links, [key]: val } }))
  }

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
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>Your Profile</h1>
        {profile && (
          <Link to={`/artist/${user.id}`} className="btn btn-outline btn-sm">View Public Profile →</Link>
        )}
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
            {profile?.is_admin && <span className="badge badge-admin" style={{ marginLeft: '0.375rem' }}>Admin</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text)' }}>
          <div><strong style={{ color: 'var(--text-h)' }}>Email:</strong> {user?.email}</div>
          <div><strong style={{ color: 'var(--text-h)' }}>Member since:</strong> {memberSince}</div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Edit Profile</h2>

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1.25rem' }}>
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

          <div className="form-group">
            <label>Bio</label>
            <textarea
              className="input"
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell fans about yourself, your music, your story…"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ margin: '1.5rem 0 1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🔗 Social Links</h3>

            <div className="form-group">
              <label>Instagram</label>
              <input
                className="input"
                type="url"
                value={form.social_links.instagram}
                onChange={e => setSocial('instagram', e.target.value)}
                placeholder="https://instagram.com/yourhandle"
              />
            </div>

            <div className="form-group">
              <label>X / Twitter</label>
              <input
                className="input"
                type="url"
                value={form.social_links.twitter}
                onChange={e => setSocial('twitter', e.target.value)}
                placeholder="https://x.com/yourhandle"
              />
            </div>

            <div className="form-group">
              <label>Spotify</label>
              <input
                className="input"
                type="url"
                value={form.social_links.spotify}
                onChange={e => setSocial('spotify', e.target.value)}
                placeholder="https://open.spotify.com/artist/…"
              />
            </div>

            <div className="form-group">
              <label>Website</label>
              <input
                className="input"
                type="url"
                value={form.social_links.website}
                onChange={e => setSocial('website', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
