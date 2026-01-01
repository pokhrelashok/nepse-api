import '../styles/landing.css'

export default function TermsOfServicePage() {
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
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Terms of Service</h1>
          <div style={styles.updated}>Last updated: December 12, 2025</div>

          <p style={styles.p}>These Terms of Service ("Terms") govern your use of NEPSE Portfolio (the "Service"). By using the Service, you agree to these Terms.</p>

          <h2 style={styles.h2}>1. What We Provide</h2>
          <p style={styles.p}>NEPSE Portfolio lets you manage stock portfolio data and view market information. We use Google Sign-In to authenticate you and Google Drive to store the portfolio data you choose to save.</p>

          <h2 style={styles.h2}>2. Your Account and Access</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>You must use your own Google account to sign in.</li>
            <li style={styles.li}>You are responsible for keeping your account secure.</li>
            <li style={styles.li}>If you suspect unauthorized access, revoke the app's access from your Google account.</li>
          </ul>

          <h2 style={styles.h2}>3. Data Ownership and Storage</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>You own the portfolio data you add to the Service.</li>
            <li style={styles.li}>Your portfolio data is stored in your Google Drive within the app's folder.</li>
            <li style={styles.li}>We only request limited Google Drive permissions needed to create and manage files.</li>
          </ul>

          <h2 style={styles.h2}>4. Acceptable Use</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>Do not misuse the Service, interfere with its operation, or attempt unauthorized access.</li>
            <li style={styles.li}>Do not use the Service to violate any applicable laws or third-party rights.</li>
            <li style={styles.li}>Do not attempt to bypass security measures or abuse rate limits.</li>
          </ul>

          <h2 style={styles.h2}>5. Availability and Changes</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>We aim for reliable service but do not guarantee uninterrupted availability.</li>
            <li style={styles.li}>We may update or improve features over time.</li>
          </ul>

          <h2 style={styles.h2}>6. Termination</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>You can stop using the Service at any time.</li>
            <li style={styles.li}>We may suspend or terminate access if you violate these Terms.</li>
          </ul>

          <h2 style={styles.h2}>7. Disclaimers</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>Market data and analytics are provided on an "as is" basis without warranties.</li>
            <li style={styles.li}>We do not provide financial, investment, or legal advice.</li>
          </ul>

          <h2 style={styles.h2}>8. Limitation of Liability</h2>
          <p style={styles.p}>To the fullest extent permitted by law, NEPSE Portfolio will not be liable for indirect, incidental, special, consequential, or punitive damages.</p>

          <h2 style={styles.h2}>9. Indemnity</h2>
          <p style={styles.p}>You agree to indemnify and hold harmless NEPSE Portfolio from claims arising out of your use of the Service.</p>

          <h2 style={styles.h2}>10. Changes to These Terms</h2>
          <p style={styles.p}>We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.</p>

          <h2 style={styles.h2}>11. Contact</h2>
          <p style={styles.p}>Questions? Contact us at <a href="mailto:portfolionepse@gmail.com" style={styles.link}>portfolionepse@gmail.com</a>.</p>
        </div>
      </div>
    </div>
  )
}
