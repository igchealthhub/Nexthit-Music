import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STATUS_COLORS = {
  draft: 'badge-fan',
  active: 'badge-active',
  voting: 'badge-pending',
  closed: 'badge-fan',
}

export default function ContestsPage() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [routeMessage, setRouteMessage] = useState('')

  useEffect(() => {
    loadContests()
  }, [profile?.is_admin])

  useEffect(() => {
    const incomingMessage = location.state?.message
    if (incomingMessage) {
      setRouteMessage(incomingMessage)
      navigate('/contests', { replace: true })
    }
  }, [location.state, navigate])

  async function loadContests() {
    setLoading(true)
    setError('')

    const isAdmin = profile?.is_admin === true

    let query = supabase
      .from('contests')
      .select('id, title, description, prize, entry_fee, start_date, end_date, status, contest_entries(id)')
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.eq('status', 'active')
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setContests([])
      setLoading(false)
      return
    }

    setContests(data || [])
    setLoading(false)
  }

  function formatDate(value) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
  }

  function formatMoney(value) {
    const numeric = Number(value || 0)
    return numeric > 0 ? `$${numeric.toFixed(2)}` : 'Free'
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎤 Contests</h1>
        <p>{profile?.is_admin ? 'All contests (admin view)' : 'Active contests open for entries and voting'}</p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          Failed to load contests: {error}
        </div>
      )}

      {routeMessage && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          {routeMessage}
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : contests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎤</div>
          <h3>No active contests yet</h3>
          <p>Check back soon for the next live contest.</p>
        </div>
      ) : (
        <div className="grid-2">
          {contests.map(c => {
            const entryCount = c.contest_entries?.length || 0
            return (
              <div key={c.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.0625rem' }}>{c.title}</h3>
                  <span className={`badge ${STATUS_COLORS[c.status] || 'badge-pending'}`} style={{ flexShrink: 0 }}>
                    {c.status}
                  </span>
                </div>
                {c.description && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.6, marginBottom: '1rem' }}>
                    {c.description}
                  </p>
                )}
                <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text)' }}>
                  <div><strong>Prize:</strong> {c.prize || '—'}</div>
                  <div><strong>Entry Fee:</strong> {formatMoney(c.entry_fee)}</div>
                  <div><strong>Start:</strong> {formatDate(c.start_date)}</div>
                  <div><strong>End:</strong> {formatDate(c.end_date)}</div>
                  <div><strong>Entries:</strong> {entryCount}</div>
                </div>
                <Link to={`/contests/${c.id}`} className="btn btn-primary btn-sm">
                  🗳️ Enter Contest
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
