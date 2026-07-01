import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import './AdminContestsPage.css'

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
const IMAGE_BUCKET = 'contest-images'

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

function formatDate(value) {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'
  return date.toLocaleString()
}

function toSafeFilename(fileName = 'cover') {
  return String(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function AdminContestsPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [contests, setContests] = useState([])
  const [entryCounts, setEntryCounts] = useState({})
  const [voteCounts, setVoteCounts] = useState({})
  const [selectedContestId, setSelectedContestId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schemaHint, setSchemaHint] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    loadContests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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

      const contestsRequest = supabase
        .from('contests')
        .select('*')
        .order('created_at', { ascending: false })

      const entriesRequest = supabase
        .from('contest_entries')
        .select('id, contest_id')

      const votesRequest = supabase
        .from('contest_votes')
        .select('id, contest_id, entry_id')

      const [contestsRes, entriesRes, votesRes] = await Promise.all([
        contestsRequest,
        entriesRequest,
        votesRequest,
      ])

      const data = contestsRes.data
      const fetchError = contestsRes.error

      console.log('ADMIN CONTESTS contests query result', data || [])
      console.log('ADMIN CONTESTS contests query error', fetchError || null)
      console.log('ADMIN CONTESTS entries query result', entriesRes.data || [])
      console.log('ADMIN CONTESTS entries query error', entriesRes.error || null)
      console.log('ADMIN CONTESTS votes query result', votesRes.data || [])
      console.log('ADMIN CONTESTS votes query error', votesRes.error || null)

      if (fetchError) {
        throw fetchError
      }

      const normalizedContests = Array.isArray(data) ? data.map(normalizeContestRow) : []
      setContests(normalizedContests)

      const entries = Array.isArray(entriesRes.data) ? entriesRes.data : []
      const votes = Array.isArray(votesRes.data) ? votesRes.data : []

      if (entriesRes.error || votesRes.error) {
        setSchemaHint('Some stats are unavailable due to query restrictions. Check contest_entries/contest_votes RLS policies.')
      }

      const entriesByContest = {}
      const entryToContest = {}
      entries.forEach(entry => {
        const contestId = entry.contest_id
        if (!contestId) return
        entriesByContest[contestId] = (entriesByContest[contestId] || 0) + 1
        entryToContest[entry.id] = contestId
      })

      const votesByContest = {}
      votes.forEach(vote => {
        const contestId = vote.contest_id || entryToContest[vote.entry_id]
        if (!contestId) return
        votesByContest[contestId] = (votesByContest[contestId] || 0) + 1
      })

      setEntryCounts(entriesByContest)
      setVoteCounts(votesByContest)
      setSelectedContestId(prev => prev || normalizedContests[0]?.id || null)
    } catch (fetchError) {
      console.error('ADMIN CONTEST LOAD ERROR', fetchError)
      setError(`Could not load contests: ${fetchError.message}`)
      setContests([])
      setEntryCounts({})
      setVoteCounts({})
      setSelectedContestId(null)
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
    setSelectedContestId(contest.id)
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

  async function handleImageUpload(file) {
    if (!file || !user?.id) return

    setUploadingImage(true)
    setError('')

    try {
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const safeName = toSafeFilename(file.name || `cover.${extension}`)
      const path = `${user.id}/${Date.now()}-${safeName}`
      const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })

      if (upload.error) {
        throw new Error(upload.error.message)
      }

      const { data: urlData, error: urlError } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
      if (urlError || !urlData?.publicUrl) {
        throw new Error(urlError?.message || 'Could not resolve uploaded cover URL.')
      }

      setForm(prev => ({ ...prev, cover_url: urlData.publicUrl }))
      setSuccess('Cover image uploaded successfully.')
    } catch (uploadError) {
      console.error('ADMIN CONTESTS image upload error', uploadError)
      setError(`Cover upload failed: ${uploadError.message}. Confirm bucket '${IMAGE_BUCKET}' exists and policies allow admin upload.`)
    } finally {
      setUploadingImage(false)
    }
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
      setSelectedContestId(createdContestId || selectedContestId)
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

  async function deleteContest(contestId) {
    if (!contestId) return
    const confirmed = window.confirm('Delete this contest? This cannot be undone.')
    if (!confirmed) return

    setDeletingId(contestId)
    setError('')
    setSuccess('')

    try {
      const { error: deleteError } = await supabase.from('contests').delete().eq('id', contestId)
      if (deleteError) {
        throw deleteError
      }
      setSuccess('Contest deleted successfully.')
      if (selectedContestId === contestId) setSelectedContestId(null)
      if (editingId === contestId) startCreate()
      await loadContests()
    } catch (deleteError) {
      console.error('ADMIN CONTESTS delete error', deleteError)
      setError(`Could not delete contest: ${deleteError.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const currentContest = useMemo(() => contests.find(contest => contest.id === editingId) || null, [contests, editingId])
  const selectedContest = useMemo(() => contests.find(contest => contest.id === selectedContestId) || contests[0] || null, [contests, selectedContestId])
  const totalEntries = useMemo(() => Object.values(entryCounts).reduce((sum, count) => sum + count, 0), [entryCounts])
  const totalVotes = useMemo(() => Object.values(voteCounts).reduce((sum, count) => sum + count, 0), [voteCounts])

  return (
    <div className="page contest-admin-page">
      <div className="page-header contest-admin-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>🏆 Manage Contests</h1>
          <p>Premium contest control center for creation, moderation, and fan-facing previews.</p>
        </div>
        <Link to="/admin" className="btn btn-outline btn-sm">← Back to Admin</Link>
      </div>

      <div className="stats-row contest-stats-row">
        <div className="stat-card contest-stat-card">
          <div className="stat-value">{contests.length}</div>
          <div className="stat-label">Total Contests</div>
        </div>
        <div className="stat-card contest-stat-card">
          <div className="stat-value">{totalEntries}</div>
          <div className="stat-label">Total Entries</div>
        </div>
        <div className="stat-card contest-stat-card">
          <div className="stat-value">{totalVotes}</div>
          <div className="stat-label">Total Votes</div>
        </div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}
      {schemaHint && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{schemaHint}</div>}
      {!isAdmin && !loading && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          This page only allows admins to create or edit contests.
        </div>
      )}

      <div className="grid-2 contest-layout-grid" style={{ marginBottom: '1rem' }}>
        <div className="card contest-form-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h3>{editingId ? 'Edit Contest' : 'Create Contest'}</h3>
            {editingId && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={startCreate}>New Contest</button>
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
              <label>Status</label>
              <select className="input" value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}>
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cover URL</label>
              <input className="input" type="url" placeholder="https://..." value={form.cover_url} onChange={e => setForm(prev => ({ ...prev, cover_url: e.target.value }))} />
            </div>
            <div className="contest-upload-row">
              <label className="btn btn-outline btn-sm contest-upload-btn" htmlFor="contest-cover-upload">
                {uploadingImage ? 'Uploading image…' : 'Upload Cover Image'}
              </label>
              <input
                id="contest-cover-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleImageUpload(e.target.files?.[0])}
                disabled={uploadingImage || !isAdmin}
              />
              {form.cover_url && (
                <a href={form.cover_url} target="_blank" rel="noreferrer" className="contest-upload-link">Preview upload</a>
              )}
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={saving || !isAdmin}>
              {saving ? 'Saving…' : editingId ? 'Update Contest' : 'Save Contest'}
            </button>
          </form>

          {currentContest && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              Editing <strong>{currentContest.title}</strong>
            </div>
          )}
        </div>

        <div className="card contest-preview-card">
          <h3 style={{ marginBottom: '1rem' }}>Fan Preview</h3>
          {!selectedContest ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <div className="empty-icon">🖼️</div>
              <h3>No contest selected</h3>
              <p>Select a contest from the table to preview fan-facing details.</p>
            </div>
          ) : (
            <div className="contest-preview-body">
              <div className="contest-preview-image">
                {selectedContest.cover_url
                  ? <img src={selectedContest.cover_url} alt={selectedContest.title || 'Contest cover'} />
                  : <span>🏆</span>}
              </div>
              <div className="contest-preview-content">
                <h4>{selectedContest.title || 'Untitled Contest'}</h4>
                <p>{selectedContest.description || 'No contest description yet.'}</p>
                <div className="contest-preview-meta">
                  <span><strong>Prize:</strong> {formatMoney(selectedContest.prize_amount)}</span>
                  <span><strong>Start:</strong> {formatDate(selectedContest.start_date)}</span>
                  <span><strong>End:</strong> {formatDate(selectedContest.end_date)}</span>
                  <span><strong>Status:</strong> <span className={`badge ${selectedContest.status === 'active' ? 'badge-active' : selectedContest.status === 'completed' ? 'badge-fan' : 'badge-pending'}`}>{selectedContest.status}</span></span>
                </div>
                <button className="btn btn-outline" type="button" disabled>Enter Contest (Preview)</button>
              </div>
            </div>
          )}
        </div>
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
          <div className="table-wrap">
            <table className="table contest-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Prize</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Entries</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contests.map(contest => (
                  <tr key={contest.id || contest.title}>
                    <td>
                      <button
                        type="button"
                        className="contest-thumb-btn"
                        onClick={() => setSelectedContestId(contest.id)}
                        title="Preview contest"
                      >
                        {contest.cover_url
                          ? <img src={contest.cover_url} alt={contest.title || 'Contest'} className="contest-thumb" />
                          : <span className="contest-thumb-placeholder">🏆</span>}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: '0.2rem' }}>
                        <strong style={{ color: 'var(--text-h)' }}>{contest.title || 'Untitled Contest'}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{contest.description || 'No description'}</span>
                      </div>
                    </td>
                    <td>{formatMoney(contest.prize_amount)}</td>
                    <td style={{ minWidth: 190 }}>
                      <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.8rem' }}>
                        <span><strong>Start:</strong> {formatDate(contest.start_date)}</span>
                        <span><strong>End:</strong> {formatDate(contest.end_date)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${contest.status === 'active' ? 'badge-active' : contest.status === 'completed' ? 'badge-fan' : 'badge-pending'}`}>
                        {contest.status}
                      </span>
                    </td>
                    <td>{entryCounts[contest.id] || 0}</td>
                    <td>
                      <div className="contest-table-actions">
                        <button className="btn btn-sm btn-outline" type="button" onClick={() => startEdit(contest)}>Edit</button>
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => setSelectedContestId(contest.id)}>View</button>
                        <button className="btn btn-sm btn-danger" type="button" disabled={deletingId === contest.id} onClick={() => deleteContest(contest.id)}>
                          {deletingId === contest.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && contests.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Quick Status Controls</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {contests.map(contest => (
              <div key={`status-${contest.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-h)', fontWeight: 600 }}>{contest.title || 'Untitled Contest'}</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map(option => (
                    <button key={option} className="btn btn-sm btn-ghost" type="button" disabled={contest.status === option} onClick={() => updateStatus(contest.id, option)}>
                      {option}
                    </button>
                  ))}
                  <button className="btn btn-sm btn-outline" type="button" onClick={() => navigate(`/contests/${contest.id}`)}>View Public</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}