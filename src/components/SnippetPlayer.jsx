import { useEffect, useRef, useState } from 'react'
import './SnippetPlayer.css'

const PREVIEW_LIMIT = 30

export default function SnippetPlayer({ src, songId, onPlayStart, fullAccess }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [previewEnded, setPreviewEnded] = useState(false)

  useEffect(() => {
    return () => audioRef.current?.pause()
  }, [])

  useEffect(() => {
    audioRef.current?.pause()
    setPlaying(false)
    setCurrentTime(0)
    setPreviewEnded(false)
  }, [src])

  function toggle() {
    if (!src) return
    const audio = audioRef.current
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    if (previewEnded && !fullAccess) {
      audio.currentTime = 0
      setPreviewEnded(false)
      setCurrentTime(0)
    }
    audio.play().catch(() => {})
    setPlaying(true)
    onPlayStart?.()
  }

  function handleTimeUpdate() {
    const t = audioRef.current.currentTime
    setCurrentTime(t)
    if (!fullAccess && t >= PREVIEW_LIMIT) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      setPreviewEnded(true)
    }
  }

  function handleLoadedMetadata() {
    setDuration(audioRef.current?.duration || 0)
  }

  function handleEnded() {
    setPlaying(false)
    if (!fullAccess) setPreviewEnded(true)
    if (audioRef.current) audioRef.current.currentTime = 0
    setCurrentTime(0)
  }

  const limit = fullAccess ? (duration || PREVIEW_LIMIT) : PREVIEW_LIMIT
  const pct = Math.min((currentTime / limit) * 100, 100)

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  return (
    <div className="snippet-player">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="none"
      />

      <button
        className={`sp-play-btn ${playing ? 'paused' : ''}`}
        onClick={toggle}
        disabled={!src}
        title={src ? (playing ? 'Pause' : fullAccess ? 'Play full song' : 'Play 30s preview') : 'No audio available'}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <div className="sp-right">
        <div className="sp-bar-wrap">
          <div className="sp-bar">
            <div className="sp-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="sp-times">
            <span>{fmt(currentTime)}</span>
            <span>{fullAccess ? (duration ? fmt(duration) : 'Full song') : '0:30 preview'}</span>
          </div>
        </div>

        {fullAccess && (
          <div className="sp-upsell" style={{ color: 'var(--success, #4ade80)' }}>
            ✅ Full song unlocked
          </div>
        )}

        {!fullAccess && previewEnded && (
          <div className="sp-upsell">
            Preview ended. Buy the full song to keep listening.
          </div>
        )}
      </div>
    </div>
  )
}
