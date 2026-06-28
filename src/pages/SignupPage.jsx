import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { value: 'fan', icon: '🎧', name: 'Fan', desc: 'Discover & support music' },
  { value: 'artist', icon: '🎤', name: 'Artist', desc: 'Upload & promote your music' },
]

function formatSignupError(error) {
  if (!error) return 'Signup failed. Please try again.'

  const parts = [
    error.message,
    error.details,
    error.hint,
    error.code ? `code=${error.code}` : null,
    error.status ? `status=${error.status}` : null,
    error.name ? `type=${error.name}` : null,
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(' | ')

  try {
    return JSON.stringify(error)
  } catch {
    return 'Signup failed. Please try again.'
  }
}

export default function SignupPage() {
  const { signUp } = useAuth()

  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'fan' })
  const [acceptedRequiredTerms, setAcceptedRequiredTerms] = useState(false)
  const [acceptedArtistAgreement, setAcceptedArtistAgreement] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!acceptedRequiredTerms || (form.role === 'artist' && !acceptedArtistAgreement)) {
      setError('You must agree to the required terms before creating an account.')
      return
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }

    try {
      setLoading(true)
      const { error } = await signUp({
        ...form,
        agreements: {
          acceptedTerms: acceptedRequiredTerms,
          acceptedPrivacy: acceptedRequiredTerms,
          acceptedArtistAgreement,
        },
      })

      if (error) {
        console.error('SIGNUP ERROR', error)
        setError(formatSignupError(error))
        return
      }

      setSuccess(true)
    } catch (error) {
      console.error('SIGNUP ERROR', error)
      setError(formatSignupError(error))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
          <h1 style={{ marginBottom: '0.5rem' }}>Check your email</h1>
          <p className="subtitle">We sent a confirmation link to <strong>{form.email}</strong></p>
          <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '1.5rem' }}>Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="subtitle">Join NextHit and discover the next hit</p>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="alert alert-info">Creating your account…</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Display name</label>
            <input
              className="input"
              type="text"
              placeholder="Your name"
              value={form.displayName}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>I am a…</label>
            <div className="role-grid">
              {ROLES.map(r => (
                <div
                  key={r.value}
                  className={`role-option ${form.role === r.value ? 'selected' : ''}`}
                  onClick={() => {
                    setForm({ ...form, role: r.value })
                    if (r.value !== 'artist') setAcceptedArtistAgreement(false)
                  }}
                >
                  <div className="role-icon">{r.icon}</div>
                  <div className="role-name">{r.name}</div>
                  <div className="role-desc">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontWeight: 400, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={acceptedRequiredTerms}
                onChange={e => setAcceptedRequiredTerms(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
              />
              <span>
                I agree to the <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>.
              </span>
            </label>
          </div>

          {form.role === 'artist' && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontWeight: 400, color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={acceptedArtistAgreement}
                  onChange={e => setAcceptedArtistAgreement(e.target.checked)}
                  style={{ marginTop: '0.25rem' }}
                />
                <span>
                  I agree to the <Link to="/artist-agreement">Artist Agreement &amp; Revenue Sharing Terms</Link>.
                </span>
              </label>
            </div>
          )}

          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
