import { useEffect, useState } from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import '../styles/landing.css'

interface MarketData {
  status: string
  is_open: boolean
  market_index?: {
    nepse_index: number
    change: number
    percentage_change: number
  }
}

export default function PublicLayout() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const res = await fetch('/api/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [] })
        })
        const result = await res.json()
        setMarketData(result.data || result)
      } catch (error) {
        console.error('Failed to fetch market data:', error)
      }
    }

    fetchMarketData()
    const interval = setInterval(fetchMarketData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '--'
    return num.toLocaleString('en-IN')
  }

  const getMarketStatus = () => {
    if (!marketData) return { class: '', text: 'Loading...' }
    if (marketData.status === 'PRE_OPEN' || marketData.status === 'PRE-OPEN') {
      return { class: 'pre-open', text: 'Pre-Open' }
    }
    if (marketData.is_open || marketData.status === 'OPEN') {
      return { class: 'open', text: 'Open' }
    }
    return { class: '', text: 'Closed' }
  }

  const status = getMarketStatus()
  const idx = marketData?.market_index

  return (
    <div className="landing-root">
      {/* Navigation */}
      <nav className="landing-navbar">
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-mark" aria-hidden="true"></span>
            <span className="landing-logo-text">Nepse Portfolio Tracker</span>
          </Link>
          <ul className="landing-nav-menu">
            <li><a href="/#features">Features</a></li>
            <li><a href="/#market-widget">Widgets</a></li>
            <li><a href="/#app-showcase">App</a></li>
          </ul>
          <div className="landing-market-ticker">
            <span className={`landing-ticker-status ${status.class}`}></span>
            <span className="landing-ticker-value">
              {idx ? formatNumber(idx.nepse_index) : '--'}
            </span>
            <span className={`landing-ticker-change ${(idx?.change || 0) >= 0 ? 'positive' : 'negative'}`}>
              {idx ? `${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.percentage_change).toFixed(2)}%` : '--'}
            </span>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-section">
            <h4>Nepse Portfolio Tracker</h4>
            <p>Simple portfolio tracking for Nepali stock investors.</p>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© 2025 Nepse Portfolio Tracker. All rights reserved.</p>
          <div className="landing-footer-legal">
            <Link to="/feedback">Feedback</Link>
            <span className="divider">|</span>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <span className="divider">|</span>
            <Link to="/terms-of-service">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
