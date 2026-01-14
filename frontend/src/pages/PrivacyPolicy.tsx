// import '../styles/landing.css'
import { Helmet } from 'react-helmet-async'

export default function PrivacyPolicyPage() {
  const styles = {
    page: { maxWidth: 900, margin: '0 auto', padding: '120px 20px 60px', lineHeight: 1.7 } as React.CSSProperties,
    card: { background: '#fff', padding: 32, borderRadius: 15, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
    h1: { fontSize: 36, marginBottom: 12, color: '#1a472a', fontWeight: 800 },
    h2: { marginTop: 32, fontSize: 22, color: '#1a472a', fontWeight: 700 },
    updated: { color: '#4b5563', fontSize: 14, marginBottom: 32 },
    p: { margin: '14px 0', color: '#374151', fontSize: 16 },
    ul: { margin: '10px 0 20px 24px' },
    li: { marginBottom: 8, color: '#374151' },
    strong: { color: '#1a472a' },
    link: { color: '#1a472a', fontWeight: 600 },
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <Helmet>
        <title>Privacy Policy - NEPSE Portfolio Tracker</title>
        <meta name="description" content="Read our privacy policy to understand how we handle your data on NEPSE Portfolio Tracker. We prioritize your privacy and data security." />
        <link rel="canonical" href="https://nepseportfoliotracker.app/privacy-policy" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Privacy Policy</h1>
          <div style={styles.updated}>Last updated: December 12, 2025</div>

          <p style={styles.p}>This Privacy Policy explains how NEPSE Portfolio ("we", "us", or "our") handles your information when you use our services. We rely on Google services to authenticate you and store your data. Our goal is to collect and use only what is necessary to provide your portfolio features and nothing more.</p>

          <h2 style={styles.h2}>1. Information We Collect</h2>
          <p style={styles.p}>We collect the minimum information needed to operate the service:</p>
          <ul style={styles.ul}>
            <li style={styles.li}><strong style={styles.strong}>Account information:</strong> Your Google account identifier (such as email) to sign you in.</li>
            <li style={styles.li}><strong style={styles.strong}>Portfolio data you provide:</strong> Symbols, quantities, transactions, or notes you enter.</li>
            <li style={styles.li}><strong style={styles.strong}>Service metadata:</strong> Basic usage logs (timestamps, request type, success or error) for reliability and security.</li>
          </ul>

          <h2 style={styles.h2}>2. How We Use Your Information</h2>
          <p style={styles.p}>We use your information solely to operate and improve the service:</p>
          <ul style={styles.ul}>
            <li style={styles.li}>Authenticate you via Google Sign-In.</li>
            <li style={styles.li}>Store and retrieve your portfolio data so you can manage it across sessions.</li>
            <li style={styles.li}>Securely back up your data in your own Google Drive.</li>
            <li style={styles.li}>Monitor service performance and prevent abuse.</li>
          </ul>

          <h2 style={styles.h2}>3. Where and How Your Data Is Stored</h2>
          <ul style={styles.ul}>
            <li style={styles.li}><strong style={styles.strong}>Google Drive only:</strong> Your portfolio data is stored in your Google Drive within our application-specific folder.</li>
            <li style={styles.li}><strong style={styles.strong}>Scoped access:</strong> We only request the minimum Google Drive scopes needed.</li>
            <li style={styles.li}><strong style={styles.strong}>Backups and retention:</strong> Your data stays in your Google Drive until you delete it or revoke access.</li>
          </ul>

          <h2 style={styles.h2}>4. Data Sharing</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>We do <strong style={styles.strong}>not</strong> sell or rent your data.</li>
            <li style={styles.li}>We do <strong style={styles.strong}>not</strong> share your portfolio data with third parties.</li>
          </ul>

          <h2 style={styles.h2}>5. Security</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>Authentication is handled through Google Sign-In.</li>
            <li style={styles.li}>Data is stored in your Google Drive with built-in encryption.</li>
            <li style={styles.li}>We use HTTPS for data in transit.</li>
          </ul>

          <h2 style={styles.h2}>6. Your Choices and Controls</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>You can view, edit, or delete your portfolio data directly within the app.</li>
            <li style={styles.li}>You can delete the app-created files from your Google Drive at any time.</li>
            <li style={styles.li}>You can revoke the app's Google access tokens through your Google account settings.</li>
          </ul>

          <h2 style={styles.h2}>7. Children's Privacy</h2>
          <p style={styles.p}>The service is not directed to children under 13.</p>

          <h2 style={styles.h2}>8. Changes to This Policy</h2>
          <p style={styles.p}>We may update this Privacy Policy to reflect improvements or legal requirements.</p>

          <h2 style={styles.h2}>9. Contact</h2>
          <p style={styles.p}>If you have questions, contact us at <a href="mailto:portfolionepse@gmail.com" style={styles.link}>portfolionepse@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  )
}
