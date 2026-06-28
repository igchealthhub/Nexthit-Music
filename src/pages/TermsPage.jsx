import './LegalPages.css'

export default function TermsPage() {
  return (
    <div className="legal-wrap">
      <article className="legal-card">
        <h1>Terms of Service</h1>
        <p>
          These Terms of Service are a placeholder summary for the NextHit platform and will be expanded with full legal language.
        </p>
        <p className="legal-meta">Last updated: June 28, 2026</p>

        <section className="legal-section">
          <h2>Platform Use</h2>
          <p>
            You agree to use NextHit only for lawful purposes and to avoid abusive behavior, fraud, spam, and unauthorized access.
          </p>
        </section>

        <section className="legal-section">
          <h2>Accounts and Content</h2>
          <p>
            You are responsible for the information and content you upload. You must have rights to all content you share.
          </p>
        </section>

        <section className="legal-section">
          <h2>Changes and Termination</h2>
          <p>
            We may update the platform and these terms over time. Continued use of NextHit after updates means you accept the revised terms.
          </p>
        </section>
      </article>
    </div>
  )
}
