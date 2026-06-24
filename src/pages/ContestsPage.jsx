import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = {
  active: 'badge-active',
  upcoming: 'badge-pending',
  closed: 'badge-fan',
}

export default function ContestsPage() {
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase
      .from('contests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setContests(data || []); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? contests : contests.filter(c => c.status === filter)

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎤 Contests</h1>
        <p>Compete, vote, and discover the next big artist</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'active', 'upcoming', 'closed'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎤</div>
          <h3>No contests {filter !== 'all' ? `with status "${filter}"` : 'yet'}</h3>
          <p>Contests will appear here. Come back soon!</p>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map(c => (
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
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Created {new Date(c.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
