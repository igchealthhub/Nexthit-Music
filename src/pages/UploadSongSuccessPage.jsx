import { useNavigate } from 'react-router-dom'

export default function UploadSongSuccessPage() {
  const navigate = useNavigate()

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h1>Song submitted for review.</h1>
        <p>Thanks for sharing your music with NextHit. Your song is now waiting for admin review. Once approved, it will appear in the app for fans to discover, rate, and support.</p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <p style={{ color: 'var(--text)', marginBottom: '2rem' }}>
          Your submission was received and is under review.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/artist-dashboard')}>
          Back to Artist Dashboard
        </button>
      </div>
    </div>
  )
}
