import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const FALLBACK_GENRES = [
  'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Electronic', 'Jazz',
  'Country', 'Soul', 'Afrobeats', 'Reggae', 'Latin', 'Classical', 'Other',
]

const AUDIO_BUCKETS = ['songs', 'song-files']
const COVER_BUCKETS = ['covers', 'cover-art']

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
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [diagnostics, setDiagnostics] = useState({
    authOk: false,
    audioUploaded: false,
    coverUploaded: false,
    dbInsertOk: false,
    artistProfileId: null,
    insertedSongId: null,
    insertedStatus: null,
    insertArtistId: null,
    insertPayload: null,
    insertErrorObject: null,
    rlsLikelyBlocked: false,
    songsArtistForeignKey: 'unknown',
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

  const redirectTimerRef = useRef(null)

  useEffect(() => {
    supabase.from('genres').select('id, name').then(({ data }) => {
      if (data?.length) setGenres(data)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current)
      }
    }
  }, [])

  function handleCoverChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function shouldTryNextBucket(error) {
    const message = (error?.message || '').toLowerCase()
    return message.includes('bucket') || message.includes('not found') || message.includes('does not exist')
  }

  async function uploadFile(buckets, path, file, label) {
    let lastError = null

    for (const bucket of buckets) {
      console.log(`[UploadSong] Uploading ${label} to bucket`, { bucket, path, fileName: file?.name, size: file?.size })
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

      console.log(`[UploadSong] ${label} upload result`, { bucket, path, data, error })

      if (error) {
        lastError = error
        if (shouldTryNextBucket(error)) {
          continue
        }
        throw new Error(`Failed to upload ${label} to ${bucket}: ${error.message}`)
      }

      const { data: urlData, error: urlError } = supabase.storage.from(bucket).getPublicUrl(path)
      if (urlError) {
        console.error('[UploadSong] getPublicUrl error', { bucket, path, urlError })
        throw new Error(`Upload succeeded, but URL generation failed for ${label} (${bucket}): ${urlError.message}`)
      }
      if (!urlData?.publicUrl) {
        throw new Error(`Upload succeeded, but URL is missing for ${label} (${bucket}).`)
      }

      return { url: urlData.publicUrl, bucket }
    }

    const bucketList = buckets.join(', ')
    throw new Error(`Could not upload ${label}. Checked buckets [${bucketList}]. Last error: ${lastError?.message || 'unknown error'}`)
  }

  async function insertSongRow(songRow) {
    const attempt = { ...songRow, status: 'pending' }
    console.log('[UploadSong] songs insert attempt payload:', attempt)

    // Preferred path: DB RPC enforces artist linkage and returns inserted row diagnostics.
    const rpcResult = await supabase.rpc('create_pending_song_upload', {
      p_title: attempt.title,
      p_description: attempt.description,
      p_genre_id: attempt.genre_id,
      p_genre: attempt.genre || null,
      p_price: attempt.price,
      p_audio_url: attempt.audio_url,
      p_cover_url: attempt.cover_url,
    })

    if (!rpcResult.error && rpcResult.data?.status === 'ok') {
      const rpcSong = rpcResult.data.song || null
      if (rpcSong?.id) {
        return {
          id: rpcSong.id,
          title: rpcSong.title || attempt.title,
          status: rpcSong.status || 'pending',
        }
      }
    }

    if (rpcResult.error) {
      console.warn('[UploadSong] create_pending_song_upload RPC unavailable/failure, falling back to direct insert', rpcResult.error)
    }

    // Fallback path if RPC migration has not been applied yet.
    const directPayload = {
      artist_id: attempt.artist_id,
      title: attempt.title,
      description: attempt.description,
      genre_id: attempt.genre_id,
      price: attempt.price,
      status: 'pending',
      audio_url: attempt.audio_url,
      cover_url: attempt.cover_url,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('songs')
      .insert([directPayload])
      .select('id, title, status')
      .single()

    console.log('[UploadSong] songs direct insert result:', { data, error })

    if (error) {
      console.error('[UploadSong] songs insert failed', error)
      const isPermission = error.code === '42501' || /permission denied|row-level security/i.test(error.message || '')
      const normalizedError = {
        message: isPermission
          ? 'Database insert blocked by RLS policy on songs. Run supabase/songs_admin_pending_rls.sql and try again.'
          : (error.message || 'Database insert failed for song.'),
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
        rawError: error,
        rlsLikelyBlocked: isPermission,
      }
      throw normalizedError
    }

    if (!data || !data.id) {
      throw { message: 'Song insert did not return a valid row.', details: null, hint: null }
    }

    return data
  }

  async function loadSongsSchemaDiagnostics() {
    const { data, error: rpcError } = await supabase.rpc('song_insert_diagnostics')
    console.log('[UploadSong] song_insert_diagnostics result', { data, rpcError })

    if (rpcError || !data) {
      setDiagnostics(prev => ({
        ...prev,
        songsArtistForeignKey: 'unknown (run supabase/song_insert_diagnostics.sql)',
      }))
      return
    }

    const fk = data?.songs_artist_fk_target || 'unknown'
    setDiagnostics(prev => ({
      ...prev,
      songsArtistForeignKey: fk,
    }))
  }

  async function resolveArtistOwnerId(authUserId) {
    const byUserId = await supabase
      .from('artist_profiles')
      .select('id, user_id')
      .eq('user_id', authUserId)
      .maybeSingle()

    console.log('[UploadSong] artist profile lookup by user_id', {
      authUserId,
      data: byUserId.data,
      error: byUserId.error,
    })

    if (byUserId.error) {
      throw new Error(`Could not query artist_profiles by user_id: ${byUserId.error.message}`)
    }

    if (!byUserId.data?.id) {
      throw new Error('No artist profile exists for this account. Please create your artist profile before uploading songs.')
    }

    return {
      artistProfileId: byUserId.data.id,
      lookupMode: 'user_id',
    }
  }

  async function notifyAdminsOfPendingSong(song) {
    const { error: rpcError } = await supabase.rpc('notify_admins_song_pending', {
      p_song_id: song.id,
      p_song_title: song.title,
    })

    if (rpcError) {
      console.error('[UploadSong] notify_admins_song_pending failed', rpcError)
      throw new Error(`Song saved, but admin notification failed: ${rpcError.message}`)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setSuccessMessage('')
    setSupabaseError(null)
    setDiagnostics({
      authOk: false,
      audioUploaded: false,
      coverUploaded: false,
      dbInsertOk: false,
      artistProfileId: null,
      insertedSongId: null,
      insertedStatus: null,
      insertArtistId: null,
      insertPayload: null,
      insertErrorObject: null,
      rlsLikelyBlocked: false,
      songsArtistForeignKey: 'unknown',
    })

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

      // Keep artist linkage explicit for song insert diagnostics and FK safety.
      const artistOwner = await resolveArtistOwnerId(user.id)
      if (!artistOwner.artistProfileId) {
        throw new Error('Could not resolve artist profile id for song insert.')
      }

      setDiagnostics(prev => ({ ...prev, artistProfileId: artistOwner.artistProfileId }))

      await loadSongsSchemaDiagnostics()

      // Upload audio
      setProgress('Uploading audio…')
      const audioExtension = audioFile.name.split('.').pop()?.toLowerCase() || 'mp3'
      const audioPath = `${user.id}/${timestamp}-${safeTitle}.${audioExtension}`
      const audioUpload = await uploadFile(AUDIO_BUCKETS, audioPath, audioFile, 'audio')
      const audioUrl = audioUpload.url
      console.log('[UploadSong] Audio uploaded', { audioPath, audioUrl, bucket: audioUpload.bucket })
      setDiagnostics(prev => ({ ...prev, audioUploaded: true }))

      // Upload cover (optional)
      let coverUrl = null
      if (coverFile) {
        setProgress('Uploading cover art…')
        const coverExtension = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const coverPath = `${user.id}/${timestamp}-${safeTitle}.${coverExtension}`
        const coverUpload = await uploadFile(COVER_BUCKETS, coverPath, coverFile, 'cover')
        coverUrl = coverUpload.url
        console.log('[UploadSong] Cover uploaded', { coverPath, coverUrl, bucket: coverUpload.bucket })
        setDiagnostics(prev => ({ ...prev, coverUploaded: true }))
      }

      // Insert song row
      setProgress('Saving song…')
      const priceFloat = form.price ? parseFloat(form.price) : null
      const selectedGenre = genreOptions.find(g => String(g.id) === String(form.genre_id))
      const songRow = {
        artist_id: artistOwner.artistProfileId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        genre_id: genres.length ? (form.genre_id || null) : null,
        genre: genres.length ? null : (selectedGenre?.name || null),
        audio_url: audioUrl,
        cover_url: coverUrl,
        price: Number.isNaN(priceFloat) ? null : priceFloat,
        status: 'pending',
        play_count: 0,
      }

      setDiagnostics(prev => ({
        ...prev,
        insertArtistId: songRow.artist_id,
        insertPayload: songRow,
      }))

      console.log('[UploadSong] songs insert payload:', songRow)

      const inserted = await insertSongRow(songRow)
      console.log('[UploadSong] Row created successfully:', inserted)
      setDiagnostics(prev => ({
        ...prev,
        dbInsertOk: true,
        insertedSongId: inserted.id,
        insertedStatus: inserted.status,
        insertErrorObject: null,
        rlsLikelyBlocked: false,
      }))

      if (inserted?.status === 'pending') {
        setProgress('Notifying admins…')
        await notifyAdminsOfPendingSong(inserted)
      }

      setSuccess(true)
      setSuccessMessage('Song submitted for review.')
      setProgress('Submission complete — redirecting to Artist Dashboard…')
      redirectTimerRef.current = setTimeout(() => navigate('/artist-dashboard', { replace: true }), 1500)
      return
    } catch (err) {
      console.error('[UploadSong] Error', err)
      const message = err?.message || 'Something went wrong while uploading the song.'
      setError(message)
      setDiagnostics(prev => ({
        ...prev,
        insertErrorObject: err?.rawError || err || null,
        rlsLikelyBlocked: err?.rlsLikelyBlocked === true,
      }))
      setSupabaseError({
        details: err?.details || null,
        hint: err?.hint || null,
        code: err?.code || null,
        raw: err?.rawError || err || null,
      })
    } finally {
      setUploading(false)
      if (!success) setProgress('')
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
                {supabaseError.raw && (
                  <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(supabaseError.raw, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        {success ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ marginBottom: '0.5rem' }}>{successMessage}</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text)' }}>
              Your song is now pending review. You will be redirected to your artist dashboard shortly.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/artist-dashboard')}>
              Go to Artist Dashboard
            </button>
          </div>
        ) : (
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
              <div>Artist profile id</div><div>{diagnostics.artistProfileId || '⏳'}</div>
              <div>Audio uploaded</div><div>{diagnostics.audioUploaded ? '✅' : '⏳'}</div>
              <div>Cover uploaded</div><div>{coverFile ? (diagnostics.coverUploaded ? '✅' : '⏳') : 'n/a'}</div>
              <div>DB insert OK</div><div>{diagnostics.dbInsertOk ? '✅' : '⏳'}</div>
              <div>Inserted song id</div><div>{diagnostics.insertedSongId || '⏳'}</div>
              <div>Inserted status</div><div>{diagnostics.insertedStatus || '⏳'}</div>
              <div>artist_id used for insert</div><div>{diagnostics.insertArtistId || '⏳'}</div>
              <div>Songs FK target</div><div>{diagnostics.songsArtistForeignKey || 'unknown'}</div>
              <div>RLS likely blocked insert</div><div>{diagnostics.rlsLikelyBlocked ? 'YES' : 'NO/UNKNOWN'}</div>
            </div>
            {diagnostics.insertPayload && (
              <pre style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                Insert payload: {JSON.stringify(diagnostics.insertPayload, null, 2)}
              </pre>
            )}
            {diagnostics.insertErrorObject && (
              <pre style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'var(--error)' }}>
                Insert error object: {JSON.stringify(diagnostics.insertErrorObject, null, 2)}
              </pre>
            )}
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
      )}
      </div>
    </div>
  )
}
