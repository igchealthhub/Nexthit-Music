import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const FALLBACK_GENRES = [
  'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'Jazz',
  'Country', 'Soul', 'Afrobeats', 'Reggae', 'Latin', 'Classical', 'Other',
]

export default function UploadSongPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [genres, setGenres] = useState([])
  const [form, setForm] = useState({ title: '', description: '', genre_id: '', price: '' })
  const [audioFile, setAudioFile] = useState(null)
  const [audioError, setAudioError] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [error, setError] = useState('')
  const [supabaseError, setSupabaseError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [diagnostics, setDiagnostics] = useState({
    authOk: false,
    audioUploaded: false,
    coverUploaded: false,
    dbInsertOk: false,
  })

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
    console.log(`[UploadSong] Uploading to bucket: ${bucket}`, { bucket, path, file })
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    console.log(`[UploadSong] Storage upload result for ${bucket}`, { bucket, path, data, error })

    if (error) {
      console.error(`[UploadSong] Storage upload failed for bucket ${bucket}`, error)
      throw new Error(`Storage upload failed (${bucket}): ${error.message}`)
    }

    const { data: urlData, error: urlError } = supabase.storage.from(bucket).getPublicUrl(path)
    if (urlError) {
      console.error('[UploadSong] getPublicUrl error', { bucket, path, urlError })
      throw new Error(`Failed to get public URL for uploaded file (${bucket}): ${urlError.message}`)
    }
    if (!urlData?.publicUrl) {
      throw new Error(`Uploaded file URL not available for ${bucket} at path ${path}`)
    }

    return urlData.publicUrl
  }

  async function insertSongRow(songRow) {
    const attempt = { ...songRow, status: 'pending' }
    console.log('[UploadSong] songs insert attempt payload:', attempt)

    const { data, error } = await supabase
      .from('songs')
      .insert([attempt])
      .select('id, title, status')
      .single()

    console.log('[UploadSong] songs insert result:', { data, error })
    console.log('SONG INSERT PAYLOAD', attempt)
    console.log('SONG INSERT ERROR', error)

    if (error) {
      console.error('[UploadSong] songs insert failed', error)
      const normalizedError = {
        message: error.message || 'Database insert failed for song.',
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      }
      throw normalizedError
    }

    if (!data || !data.id) {
      throw { message: 'Song insert did not return a valid row.', details: null, hint: null }
    }

    return data
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setDiagnostics({ authOk: false, audioUploaded: false, coverUploaded: false, dbInsertOk: false })

    if (!form.title.trim()) { setError('Song title is required.'); return }
    if (!audioFile) { setError('Please select an audio file.'); return }
    if (!user?.id) { setError('Unable to detect your user account. Please sign out and sign back in.'); return }

    setUploading(true)

    try {
      const timestamp = Date.now()
      const safeTitle = form.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()

      console.log('[UploadSong] current user:', user)
      console.log('[UploadSong] current profile:', profile)
      console.log('[UploadSong] selected audio file:', audioFile)
      console.log('[UploadSong] selected cover file:', coverFile)

      setDiagnostics(prev => ({ ...prev, authOk: true }))

      // Upload audio
      setProgress('Uploading audio…')
      const audioExtension = audioFile.name.split('.').pop()?.toLowerCase() || 'mp3'
      const audioPath = `${user.id}/${timestamp}-${safeTitle}.${audioExtension}`
      const audioUrl = await uploadFile('song-files', audioPath, audioFile)
      console.log('[UploadSong] Audio uploaded', { audioPath, audioUrl })
      setDiagnostics(prev => ({ ...prev, audioUploaded: true }))

      // Upload cover (optional)
      let coverUrl = null
      if (coverFile) {
        setProgress('Uploading cover art…')
        const coverExtension = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const coverPath = `${user.id}/${timestamp}-${safeTitle}.${coverExtension}`
        coverUrl = await uploadFile('cover-art', coverPath, coverFile)
        console.log('[UploadSong] Cover uploaded', { coverPath, coverUrl })
        setDiagnostics(prev => ({ ...prev, coverUploaded: true }))
      }

      // Insert song row
      setProgress('Saving song…')
      const priceFloat = form.price ? parseFloat(form.price) : null
      const songRow = {
        artist_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        genre_id: form.genre_id || null,
        audio_url: audioUrl,
        cover_url: coverUrl,
        price: Number.isNaN(priceFloat) ? null : priceFloat,
        status: 'pending',
        play_count: 0,
      }

      console.log('[UploadSong] songs insert payload:', songRow)

      const inserted = await insertSongRow(songRow)
      console.log('[UploadSong] Row created successfully:', inserted)
      setDiagnostics(prev => ({ ...prev, dbInsertOk: true }))

      navigate('/upload/song/success', { replace: true })
      return
    } catch (err) {
      console.error('[UploadSong] Error', err)
      const message = err?.message || 'Something went wrong while uploading the song.'
      setError(message)
      setSupabaseError({
        details: err?.details || null,
        hint: err?.hint || null,
        code: err?.code || null,
      })
    } finally {
      setUploading(false)
      setProgress('')
    }
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
        {error && (
          <div className="alert alert-error">
            <div>{error}</div>
            {supabaseError && (
              <div style={{ marginTop: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {supabaseError.details && <div><strong>Details:</strong> {supabaseError.details}</div>}
                {supabaseError.hint && <div><strong>Hint:</strong> {supabaseError.hint}</div>}
                {supabaseError.code && <div><strong>Code:</strong> {supabaseError.code}</div>}
              </div>
            )}
          </div>
        )}

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

          <div style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)' }}>
            <strong style={{ display: 'block', marginBottom: '0.75rem' }}>Upload diagnostics</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>Auth OK</div><div>{diagnostics.authOk ? '✅' : '⏳'}</div>
              <div>Audio uploaded</div><div>{diagnostics.audioUploaded ? '✅' : '⏳'}</div>
              <div>Cover uploaded</div><div>{coverFile ? (diagnostics.coverUploaded ? '✅' : '⏳') : 'n/a'}</div>
              <div>DB insert OK</div><div>{diagnostics.dbInsertOk ? '✅' : '⏳'}</div>
            </div>
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
