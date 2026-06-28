import './LegalPages.css'

export default function ArtistAgreementPage() {
  return (
    <div className="legal-wrap">
      <article className="legal-card">
        <h1>Artist Agreement & Revenue Sharing Terms</h1>
        <p>
          This agreement outlines core business terms for artists using NextHit. It is a concise version and may be expanded with full legal drafting.
        </p>
        <p className="legal-meta">Last updated: June 28, 2026</p>

        <section className="legal-section">
          <h2>Ownership and Rights</h2>
          <ul className="legal-list">
            <li>Artists keep 100% ownership of their music, videos, branding, and intellectual property.</li>
            <li>Artists grant NextHit a limited license to host, stream, distribute, and promote submitted content on the platform.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Revenue Share</h2>
          <ul className="legal-list">
            <li>NextHit receives 15% of digital song sales, memberships, livestreams, and virtual events.</li>
            <li>NextHit receives 10% of tips and merchandise sales processed through the platform.</li>
            <li>Processing and payment fees are deducted before payout amounts are calculated.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Payout Terms</h2>
          <ul className="legal-list">
            <li>Minimum payout threshold is $25.</li>
            <li>Payouts are issued monthly within 30 days after the end of each month.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Artist Responsibilities</h2>
          <ul className="legal-list">
            <li>Artists are responsible for rights clearance, licenses, and all tax obligations.</li>
            <li>Fraud, fake streams, manipulated engagement, or other deceptive conduct is prohibited.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Governing Law and Disputes</h2>
          <ul className="legal-list">
            <li>This agreement is governed by Oklahoma law.</li>
            <li>Disputes should first be addressed through good-faith negotiation, followed by applicable dispute resolution procedures under Oklahoma law.</li>
          </ul>
        </section>
      </article>
    </div>
  )
}
