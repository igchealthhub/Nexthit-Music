import './LegalPages.css'

export default function PrivacyPage() {
  return (
    <div className="legal-wrap">
      <article className="legal-card">
        <h1>Privacy Policy</h1>
        <p>
          This Privacy Policy is a placeholder summary for NextHit and will be expanded with complete policy language.
        </p>
        <p className="legal-meta">Last updated: June 28, 2026</p>

        <section className="legal-section">
          <h2>Information We Collect</h2>
          <p>
            We collect account details, profile information, and activity data needed to operate music features and user accounts.
          </p>
        </section>

        <section className="legal-section">
          <h2>How We Use Information</h2>
          <p>
            Data is used to provide services, improve performance, secure the platform, and communicate account and product updates.
          </p>
        </section>

        <section className="legal-section">
          <h2>Data Sharing and Security</h2>
          <p>
            We do not sell personal data. We use trusted providers to operate the platform and apply reasonable security controls.
          </p>
        </section>
      </article>
    </div>
  )
}
