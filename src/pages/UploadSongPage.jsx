import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const FALLBACK_GENRES = [
  'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'Jazz',
  'Country', 'Soul', 'Afrobeats', 'Reggae', 'Latin', 'Classical', 'Other',
]

export default function UploadSongPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [genres, setGenres] = useState([])
  const [form, setForm] = useState({ title: '', description: '', genre_id: '', price: '' })
  const [audioFile, setAudioFile] = useState(null)
  const [audioError, setAudioError] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [success, setSuccess] = useState(false)

  // Validate by extension — iOS/Safari often reports audio files as
  // application/octet-stream, so MIME-type checks alone will reject them.
  const ACCEPTED_AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'flac', 'mp4', 'aiff', 'aif', 'caf', 'opus', 'weba']

  function isValidAudioFile(file) {
    if (!file) return false
    if (file.type.startsWith('audio/')) return true
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    return ACCEPTED_AUDIO_EXTS.includes(ext)
  }

  function handleAudioChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!isValidAudioFile(file)) {
      setAudioError('Unsupported format. Please use MP3, M4A, WAV, AAC, OGG, or FLAC.')
      setAudioFile(null)
      return
    }
    setAudioError('')
    setAudioFile(file)
  }

  useEffect(() => {
    supabase.from('genres').select('id, name').then(({ data }) => {
      if (data?.length) setGenres(data)
    })
  }, [])

  function handleCoverChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function uploadFile(bucket, path, file) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw new Error(`Storage upload failed (${bucket}): ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Song title is required.'); return }
    if (!audioFile) { setError('Please select an audio file.'); return }

    setUploading(true)

    try {
      const timestamp = Date.now()
      const safeTitle = form.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

      // Upload audio
      setProgress('Uploading audio…')
      const audioPath = `${user.id}/${timestamp}-${safeTitle}.${audioFile.name.split('.').pop()}`
      const audioUrl = await uploadFile('song-files', audioPath, audioFile)

      // Upload cover (optional)
      let coverUrl = null
      if (coverFile) {
        setProgress('Uploading cover art…')
        const coverPath = `${user.id}/${timestamp}-${safeTitle}.${coverFile.name.split('.').pop()}`
        coverUrl = await uploadFile('cover-art', coverPath, coverFile)
      }

      // Insert song row
      setProgress('Saving song…')
      const songRow = {
        artist_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        audio_url: audioUrl,
        cover_url: coverUrl,   // confirmed column name from schema probe
        status: 'pending',
        play_count: 0,
      }
      // Only include genre_id when it came from the real DB (genres array populated).
      // Fallback genres use fake numeric IDs that would violate the UUID FK constraint.
      if (form.genre_id && genres.length > 0) songRow.genre_id = form.genre_id
      if (form.price) songRow.price = parseFloat(form.price)

      console.log('[UploadSong] Inserting row:', songRow)

      // Use .select() so we get back the created row and can confirm the insert worked.
      // Without .select(), a silent RLS failure can return {data: null, error: null}.
      const { data: inserted, error: insertError } = await supabase
        .from('songs')
        .insert(songRow)
        .select('id, title, status')
        .single()

      console.log('[UploadSong] Insert result:', { inserted, insertError })

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message} (code: ${insertError.code})`)
      }
      if (!inserted) {
        throw new Error('Insert returned no data. The songs RLS INSERT policy may be missing — run the SQL policies in Supabase.')
      }

      console.log('[UploadSong] Row created successfully:', inserted.id)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  if (success) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ marginBottom: '0.5rem' }}>Song submitted!</h1>
          <p style={{ color: 'var(--text)', marginBottom: '2rem' }}>
            Your song has been submitted for review. You'll see it in your Artist Hub once approved.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setSuccess(false); setForm({ title: '', description: '', genre_id: '', price: '' }); setAudioFile(null); setAudioError(''); setCoverFile(null); setCoverPreview(null) }}>
              Upload another
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/artist-dashboard')}>
              Artist Hub
            </button>
          </div>
        </div>
      </div>
    )
  }

  const genreOptions = genres.length
    ? genres
    : FALLBACK_GENRES.map((n, i) => ({ id: String(i + 1), name: n }))

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <h1>Upload Song</h1>
        <p>Submit your music for review. Approved songs appear in the public feed.</p>
      </div>

      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Cover art */}
          <div className="form-group">
            <label>Cover Art</label>
            <div
              style={{
                border: '2px dashed var(--border)', borderRadius: 10,
                padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
                background: 'var(--surface-2)', position: 'relative',
                transition: 'border-color 0.2s',
              }}
              onClick={() => document.getElementById('cover-input').click()}
            >
              {coverPreview ? (
                <img src={coverPreview} alt="Cover preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖼️</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Click to upload cover image</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>JPG, PNG — recommended 500×500px</p>
                </>
              )}
              <input id="cover-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
            </div>
          </div>

          <div className="form-group">
            <label>Song Title *</label>
            <input className="input" type="text" placeholder="My Amazing Track"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea className="input" placeholder="Tell listeners about this song…"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Genre</label>
              <select className="input" value={form.genre_id} onChange={e => setForm({ ...form, genre_id: e.target.value })}>
                <option value="">Select genre</option>
                {genreOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Price (USD)</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.99"
                value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Audio File *</label>
            <div
              style={{
                border: '2px dashed var(--border)', borderRadius: 10,
                padding: '1.25rem', textAlign: 'center', cursor: 'pointer',
                background: audioFile ? 'rgba(34,197,94,0.08)' : 'var(--surface-2)',
                borderColor: audioFile ? 'var(--success)' : 'var(--border)',
                transition: 'all 0.2s',
              }}
              onClick={() => document.getElementById('audio-input').click()}
            >
              {audioFile ? (
                <div>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>✅</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--success)', wordBreak: 'break-all' }}>{audioFile.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB — tap to change
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🎵</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tap or click to select audio file</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    MP3 · M4A · WAV · AAC · OGG · FLAC
                  </p>
                </>
              )}
              {/* Combined accept: audio/* covers most browsers; explicit extensions
                  unblock iOS/Safari which grays files it can't match to audio/* alone */}
              <input
                id="audio-input"
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac,.aiff,.aif,.opus,.caf"
                style={{ display: 'none' }}
                onChange={handleAudioChange}
              />
            </div>
            {audioError && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--error)' }}>
                ⚠️ {audioError} Accepted formats: MP3, M4A, WAV, AAC, OGG, FLAC, AIFF.
              </p>
            )}
          </div>

          <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
            ℹ️ Songs are reviewed before going live. Public listeners hear a 30-second preview only.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary btn-lg" type="submit" disabled={uploading}>
              {uploading ? progress || 'Uploading…' : 'Submit for Review'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)} disabled={uploading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
