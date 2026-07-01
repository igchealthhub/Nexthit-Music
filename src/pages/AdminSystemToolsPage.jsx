import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminSystemToolsPage() {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function runCleanup() {
    const approved = window.confirm('This will permanently delete all @nexthit.test users and related records. Continue?')
    if (!approved) return

    setRunning(true)
    setError('')
    setResult(null)

    const { data, error: rpcError } = await supabase.rpc('admin_clean_test_data')

    if (rpcError) {
      setError(rpcError.message || 'Cleanup failed.')
      setRunning(false)
      return
    }

    setResult(data || {})
    setRunning(false)
  }

  return (
    <div className="page" style={{ maxWidth: 840 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1>🛠️ Admin System Tools</h1>
          <p>Maintenance actions for test environments</p>
        </div>
        <Link to="/admin" className="btn btn-outline btn-sm">← Back to Admin</Link>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Last Cleanup Result</h3>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text)', fontSize: '0.875rem' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="card" style={{ borderColor: 'var(--danger)' }}>
        <h3 style={{ marginBottom: '0.5rem', color: 'var(--danger)' }}>Danger Zone</h3>
        <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
          Clean test data for users with emails ending in <strong>@nexthit.test</strong>.
          This action deletes matching users and related rows from:
          profiles, artist_profiles, songs, notifications, contests, and purchases.
        </p>
        <button className="btn btn-danger" onClick={runCleanup} disabled={running}>
          {running ? 'Cleaning test data…' : 'Clean Test Data'}
        </button>
      </div>
    </div>
  )
}
