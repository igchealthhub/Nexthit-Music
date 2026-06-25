import { useEffect, useRef, useState } from 'react'
import './SnippetPlayer.css'

const PREVIEW_LIMIT = 30

export default function SnippetPlayer({ src, songId, onPlayStart }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [previewEnded, setPreviewEnded] = useState(false)

  useEffect(() => {
    return () => audioRef.current?.pause()
  }, [])

  // Stop if a different song is played externally (parent resets src)
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
    if (previewEnded) {
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
    if (t >= PREVIEW_LIMIT) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setPlaying(false)
      setPreviewEnded(true)
    }
  }

  const pct = Math.min((currentTime / PREVIEW_LIMIT) * 100, 100)

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  return (
    <div className="snippet-player">
      <audio ref={audioRef} src={src} onTimeUpdate={handleTimeUpdate} preload="none" />

      <button
        className={`sp-play-btn ${playing ? 'paused' : ''}`}
        onClick={toggle}
        disabled={!src}
        title={src ? (playing ? 'Pause' : 'Play 30s preview') : 'No audio available'}
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
            <span>0:30 preview</span>
          </div>
        </div>

        {previewEnded && (
          <div className="sp-upsell">
            Preview ended. Buy the full song to keep listening.
          </div>
        )}
      </div>
    </div>
  )
}
