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

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${searchQuery}`)
        const data = await res.json()
        setSearchResults(data.data || data)
      } catch (error) {
        console.error('Search failed:', error)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  const status = getMarketStatus()
  const idx = marketData?.market_index

  return (
    <div className="landing-root">
      {/* Navigation */}
      <nav className="landing-navbar">
        <div className="landing-nav-container">
          <Link to="/" className="landing-logo" onClick={() => setShowResults(false)}>
            <span className="landing-logo-mark" aria-hidden="true"></span>
            <span className="landing-logo-text">Nepse Portfolio Tracker</span>
          </Link>

          <div className="landing-nav-links">
            <Link to="/stocks" className="nav-link">Stocks</Link>
          </div>

          <div className="nav-search-container">
            <div className="search-input-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input
                type="text"
                placeholder="Search stocks (NTC, UPPER...)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowResults(true)
                }}
                onFocus={() => setShowResults(true)}
              />
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((item) => (
                  <Link
                    key={item.symbol}
                    to="/script/$symbol"
                    params={{ symbol: item.symbol }}
                    className="search-result-item"
                    onClick={() => {
                      setShowResults(false)
                      setSearchQuery('')
                    }}
                  >
                    <div className="result-symbol">{item.symbol}</div>
                    <div className="result-name">{item.name || item.company_name}</div>
                  </Link>
                ))}
              </div>
            )}
            {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="search-dropdown">
                <div className="search-no-results">No stocks found</div>
              </div>
            )}
          </div>

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
