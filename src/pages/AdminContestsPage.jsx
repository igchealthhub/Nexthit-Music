import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = {
  title: '',
  description: '',
  prize_amount: '0',
  start_date: '',
  end_date: '',
  cover_url: '',
  status: 'draft',
}

const STATUS_OPTIONS = ['draft', 'active', 'completed']

function normalizeContestStatus(value) {
  const normalized = String(value || 'draft').toLowerCase()
  if (normalized === 'closed' || normalized === 'archived') return 'completed'
  if (normalized === 'draft' || normalized === 'active' || normalized === 'completed') return normalized
  return 'draft'
}

function parsePrizeAmount(value) {
  if (value === null || value === undefined || value === '') return 0
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeContestRow(contest) {
  if (!contest) return contest
  return {
    ...contest,
    prize_amount: contest.prize_amount ?? parsePrizeAmount(contest.prize),
    cover_url: contest.cover_url || null,
    status: normalizeContestStatus(contest.status),
  }
}

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
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schemaHint, setSchemaHint] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    loadContests()
  }, [])

  async function loadContests() {
    setLoading(true)
    setError('')
    setSchemaHint('')

    try {
      console.log('ADMIN CONTESTS user id', user?.id || null)
      console.log('ADMIN CONTESTS profile', profile || null)

      if (!user?.id) {
        setIsAdmin(false)
        setError('You must be logged in to manage contests.')
        setContests([])
        return
      }

      const { data: adminProfile, error: adminProfileError } = await supabase
        .from('profiles')
        .select('id, is_admin')
        .eq('id', user.id)
        .maybeSingle()

      const resolvedIsAdmin = Boolean(adminProfile?.is_admin === true || profile?.is_admin === true)
      console.log('ADMIN CONTESTS is_admin', resolvedIsAdmin)

      if (adminProfileError) {
        setIsAdmin(false)
        setError(`Could not verify admin profile: ${adminProfileError.message}`)
        setContests([])
        return
      }

      setIsAdmin(resolvedIsAdmin)

      if (!resolvedIsAdmin) {
        setError('Admin access required. profiles.is_admin must be true.')
        setContests([])
        return
      }

      const { data, error: fetchError } = await supabase
        .from('contests')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('ADMIN CONTESTS contests query result', data || [])
      console.log('ADMIN CONTESTS contests query error', fetchError || null)

      if (fetchError) {
        throw fetchError
      }

      const normalizedContests = Array.isArray(data) ? data.map(normalizeContestRow) : []
      setContests(normalizedContests)
    } catch (fetchError) {
      console.error('ADMIN CONTEST LOAD ERROR', fetchError)
      setError(`Could not load contests: ${fetchError.message}`)
      setContests([])
    } finally {
      setLoading(false)
    }
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

    console.log('ADMIN CONTESTS profile', data || null)
    console.log('ADMIN CONTESTS is_admin', data?.is_admin === true)

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
      prize_amount: String(contest.prize_amount ?? 0),
      start_date: toDatetimeLocal(contest.start_date),
      end_date: toDatetimeLocal(contest.end_date),
      cover_url: contest.cover_url || '',
      status: normalizeContestStatus(contest.status),
    })
    setError('')
    setSuccess('')
    setSchemaHint('')
  }

  async function saveContestWithFallback(payload, isEditing) {
    const updatePayload = { ...payload }
    delete updatePayload.created_by

    const primaryRequest = isEditing
      ? supabase.from('contests').update(updatePayload).eq('id', editingId).select('*').single()
      : supabase.from('contests').insert(payload).select('*').single()

    let result = await primaryRequest
    if (!result.error) return result

    const message = result.error.message || ''
    const needsLegacyFallback =
      result.error.code === 'PGRST204' ||
      /prize_amount|cover_url|completed|status/i.test(message)

    if (!needsLegacyFallback) {
      return result
    }

    const legacyStatus = payload.status === 'completed' ? 'closed' : payload.status
    const legacyPayload = {
      title: payload.title,
      description: payload.description,
      prize: payload.prize_amount > 0 ? String(payload.prize_amount) : null,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: legacyStatus,
      created_by: payload.created_by,
    }
    const legacyUpdatePayload = { ...legacyPayload }
    delete legacyUpdatePayload.created_by

    setSchemaHint('Contest manager is using legacy column compatibility. Run the Supabase migration to add prize_amount, cover_url, and completed status support.')

    result = isEditing
      ? await supabase.from('contests').update(legacyUpdatePayload).eq('id', editingId).select('*').single()
      : await supabase.from('contests').insert(legacyPayload).select('*').single()

    return result
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSchemaHint('')

    if (!form.title.trim()) {
      setError('Contest title is required.')
      return
    }

    const prizeAmount = Number(form.prize_amount)
    if (Number.isNaN(prizeAmount) || prizeAmount < 0) {
      setError('Prize amount must be a valid non-negative number.')
      return
    }

    const isAdmin = await isAdminFromProfiles()
    if (!isAdmin) {
      setError('Only admins (profiles.is_admin = true) can create or edit contests.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        prize_amount: prizeAmount,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        cover_url: form.cover_url.trim() || null,
        status: normalizeContestStatus(form.status),
        created_by: user?.id || null,
      }

      console.log('CREATE CONTEST PAYLOAD', payload)

      const { data: savedContest, error: saveError } = await saveContestWithFallback(payload, Boolean(editingId))

      if (saveError) {
        console.error('CREATE CONTEST ERROR', saveError)
        setError(`Could not create contest: ${saveError.message}`)
        return
      }

      const normalizedSavedContest = normalizeContestRow(savedContest)
      const createdContestId = normalizedSavedContest?.id
      if (!editingId && !createdContestId) {
        setError('Contest was saved but no contest id was returned.')
        return
      }

      setForm(EMPTY_FORM)
      setEditingId(null)
      setSuccess(editingId ? 'Contest updated successfully.' : 'Contest created successfully.')
      await loadContests()

      if (!editingId && createdContestId) {
        navigate(`/contests/${createdContestId}`, {
          state: { message: 'Contest created successfully.' },
        })
      }
    } catch (saveError) {
      console.error('CREATE CONTEST ERROR', saveError)
      setError(`Could not create contest: ${saveError.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id, status) {
    setError('')
    setSchemaHint('')
    const normalizedStatus = normalizeContestStatus(status)
    const primary = await supabase.from('contests').update({ status: normalizedStatus }).eq('id', id)
    if (primary.error) {
      const fallbackStatus = normalizedStatus === 'completed' ? 'closed' : normalizedStatus
      const fallback = await supabase.from('contests').update({ status: fallbackStatus }).eq('id', id)
      if (fallback.error) {
        setError(fallback.error.message)
        return
      }
      setSchemaHint('Contest status was saved using legacy status compatibility. Run the Supabase migration to add completed status support.')
    }
    await loadContests()
  }

  const currentContest = useMemo(() => contests.find(contest => contest.id === editingId) || null, [contests, editingId])

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>🏆 Manage Contests</h1>
          <p>Create, edit, and publish contests from inside the app.</p>
        </div>
        <Link to="/admin" className="btn btn-outline btn-sm">← Back to Admin</Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}
      {schemaHint && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{schemaHint}</div>}
      {!isAdmin && !loading && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          This page only allows admins to create or edit contests.
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
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
            <label>Prize Amount</label>
            <input className="input" type="number" min="0" step="0.01" value={form.prize_amount} onChange={e => setForm(prev => ({ ...prev, prize_amount: e.target.value }))} />
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
            <label>Cover Image URL</label>
            <input className="input" type="url" placeholder="https://..." value={form.cover_url} onChange={e => setForm(prev => ({ ...prev, cover_url: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="input" value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
              {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={saving || !isAdmin}>
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
          <div className="loading-screen" style={{ minHeight: 220 }}>
            <div className="spinner" />
          </div>
        ) : contests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏆</div>
            <h3>No contests yet</h3>
            <p>Create your first contest to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {contests.map(contest => (
              <div key={contest.id || contest.title} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>
                      {contest.cover_url ? <img src={contest.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏆'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-h)' }}>{contest.title || 'Untitled Contest'}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{contest.description || 'No description'}</div>
                    </div>
                  </div>
                  <span className={`badge ${contest.status === 'active' ? 'badge-active' : contest.status === 'completed' ? 'badge-fan' : 'badge-pending'}`}>
                    {contest.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text)' }}>
                  <div><strong>Prize Amount:</strong> {formatMoney(contest.prize_amount)}</div>
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
  )
}