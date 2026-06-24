import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="home">
      <section className="hero-section">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge">🎵 Music Discovery Platform</div>
          <h1 className="hero-title">
            Discover the <span className="gradient-text">Next Hit</span>
          </h1>
          <p className="hero-sub">
            Stream emerging artists, vote on your favorites, and be part of the movement
            that launches careers.
          </p>
          <div className="hero-actions">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/signup" className="btn btn-primary btn-lg">Get Started Free</Link>
                <Link to="/songs" className="btn btn-outline btn-lg">Browse Music</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="features-section page">
        <div className="section-header" style={{ justifyContent: 'center', textAlign: 'center', display: 'block', marginBottom: '2.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Everything music needs</h2>
          <p>A full platform for fans and artists</p>
        </div>
        <div className="grid-3">
          {[
            { icon: '🎧', title: 'Stream Music', desc: 'Listen to thousands of tracks from independent artists breaking through.' },
            { icon: '🏆', title: 'Vote & Contest', desc: 'Vote for your favorite songs in contests. Help artists win prizes and recognition.' },
            { icon: '📈', title: 'Live Leaderboard', desc: 'Real-time rankings show which tracks are climbing the charts right now.' },
            { icon: '🎤', title: 'Artist Tools', desc: 'Upload songs and videos, track your plays, and grow your fanbase.' },
            { icon: '🎬', title: 'Music Videos', desc: 'Watch official videos, live sessions, and behind-the-scenes content.' },
            { icon: '🌟', title: 'Community', desc: 'Connect with fans and artists who share your passion for new music.' },
          ].map(f => (
            <div key={f.title} className="card feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2>Are you an artist?</h2>
          <p>Upload your music, grow your audience, and compete for the top spot.</p>
          <Link to="/signup" className="btn btn-primary btn-lg">Join as Artist</Link>
        </div>
      </section>
    </div>
  )
}
