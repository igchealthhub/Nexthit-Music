import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
  title: '',
  description: '',
  prize: '',
  entry_fee: '0',
  start_date: '',
  end_date: '',
  status: 'draft',
}

const STATUS_OPTIONS = ['draft', 'active', 'closed', 'archived']

function toDatetimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatMoney(value) {
  const numeric = Number(value || 0)
  return numeric > 0 ? `$${numeric.toFixed(2)}` : 'Free'
}

export default function AdminContestsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    loadContests()
  }, [])

  async function loadContests() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('contests')
      .select('id, title, description, prize, entry_fee, start_date, end_date, status, created_by, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setContests([])
      setLoading(false)
      return
    }

    setContests(data || [])
    setLoading(false)
  }

  async function isAdminFromProfiles() {
    if (!user?.id) return false

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setError(`Could not verify admin profile: ${profileError.message}`)
      return false
    }

    return data?.is_admin === true
  }

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setSuccess('')
  }

  function startEdit(contest) {
    setEditingId(contest.id)
    setForm({
      title: contest.title || '',
      description: contest.description || '',
      prize: contest.prize || '',
      entry_fee: String(contest.entry_fee ?? 0),
      start_date: toDatetimeLocal(contest.start_date),
      end_date: toDatetimeLocal(contest.end_date),
      status: contest.status || 'draft',
    })
    setError('')
    setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.title.trim()) {
      setError('Contest title is required.')
      return
    }

    const entryFeeValue = Number(form.entry_fee)
    if (Number.isNaN(entryFeeValue) || entryFeeValue < 0) {
      setError('Entry fee must be a valid non-negative number.')
      return
    }

    const isAdmin = await isAdminFromProfiles()
    if (!isAdmin) {
      setError('Only admins (profiles.is_admin = true) can create or edit contests.')
      return
    }

    setSaving(true)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      prize: form.prize.trim() || null,
      entry_fee: entryFeeValue,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      created_by: user?.id || null,
    }

    console.log('CREATE CONTEST PAYLOAD', payload)

    const updatePayload = { ...payload }
    delete updatePayload.created_by

    const request = editingId
      ? supabase.from('contests').update(updatePayload).eq('id', editingId).select('*').single()
      : supabase.from('contests').insert(payload).select('*').single()

    const { data: savedContest, error: saveError } = await request

    if (saveError) {
      console.error('CREATE CONTEST ERROR', saveError)
      setError(`Could not create contest: ${saveError.message}`)
      setSaving(false)
      return
    }

    const createdContestId = savedContest?.id
    if (!editingId && !createdContestId) {
      setError('Contest was saved but no contest id was returned.')
      setSaving(false)
      return
    }

    setForm(EMPTY_FORM)
    setEditingId(null)
    setSaving(false)
    setSuccess('Contest created successfully.')
    await loadContests()

    if (!editingId && createdContestId) {
      navigate(`/contests/${createdContestId}`, {
        state: { message: 'Contest created successfully.' },
      })
    }
  }

  async function updateStatus(id, status) {
    setError('')
    const { error: updateError } = await supabase.from('contests').update({ status }).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await loadContests()
  }

  const currentContest = useMemo(() => contests.find(contest => contest.id === editingId) || null, [contests, editingId])

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>🏆 Contest Manager</h1>
          <p>Create, edit, and publish contests from inside the app</p>
        </div>
        <Link to="/admin" className="btn btn-outline btn-sm">← Back to Admin</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h3>{editingId ? 'Edit Contest' : 'Create Contest'}</h3>
            {editingId && (
              <button className="btn btn-ghost btn-sm" onClick={startCreate}>New Contest</button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title *</label>
              <input className="input" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="input" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Prize</label>
              <input className="input" value={form.prize} onChange={e => setForm(prev => ({ ...prev, prize: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Entry Fee</label>
              <input className="input" type="number" min="0" step="0.01" value={form.entry_fee} onChange={e => setForm(prev => ({ ...prev, entry_fee: e.target.value }))} />
            </div>
            <div className="grid-2" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label>Start Date</label>
                <input className="input" type="datetime-local" value={form.start_date} onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input className="input" type="datetime-local" value={form.end_date} onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="input" value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Contest' : 'Create Contest'}
            </button>
          </form>

          {currentContest && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              Editing <strong>{currentContest.title}</strong>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Existing Contests</h3>
          {loading ? (
            <div className="loading-screen" style={{ minHeight: 220 }}><div className="spinner" /></div>
          ) : contests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏆</div>
              <h3>No contests yet</h3>
              <p>Create your first contest to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {contests.map(contest => (
                <div key={contest.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-h)' }}>{contest.title}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{contest.description || 'No description'}</div>
                    </div>
                    <span className={`badge ${contest.status === 'active' ? 'badge-active' : contest.status === 'closed' ? 'badge-fan' : contest.status === 'archived' ? 'badge-admin' : 'badge-pending'}`}>
                      {contest.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text)' }}>
                    <div><strong>Prize:</strong> {contest.prize || '—'}</div>
                    <div><strong>Entry Fee:</strong> {formatMoney(contest.entry_fee)}</div>
                    <div><strong>Start:</strong> {contest.start_date ? new Date(contest.start_date).toLocaleString() : '—'}</div>
                    <div><strong>End:</strong> {contest.end_date ? new Date(contest.end_date).toLocaleString() : '—'}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => startEdit(contest)}>Edit</button>
                    {STATUS_OPTIONS.map(option => (
                      <button key={option} className="btn btn-sm btn-ghost" disabled={contest.status === option} onClick={() => updateStatus(contest.id, option)}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}