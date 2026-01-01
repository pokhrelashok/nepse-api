import { useEffect, useState } from 'react'
import '../styles/landing.css'

interface MarketData {
  status: string
  is_open: boolean
  market_index?: {
    nepse_index: number
    change: number
    percentage_change: number
    total_turnover: number
    total_traded_shares: number
    advanced: number
    declined: number
    unchanged: number
    trading_date: string
  }
}

interface StockItem {
  symbol: string
  close_price?: number
  closePrice?: number
  ltp?: number
  percentage_change?: number
  percentageChange?: number
}

export default function LandingPage() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [gainers, setGainers] = useState<StockItem[]>([])
  const [losers, setLosers] = useState<StockItem[]>([])
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const marketRes = await fetch('/api/updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [] })
        })
        const marketResult = await marketRes.json()
        setMarketData(marketResult.data || marketResult)

        const gainersRes = await fetch('/api/market/gainers?limit=5')
        const gainersResult = await gainersRes.json()
        setGainers(gainersResult.data || gainersResult)

        const losersRes = await fetch('/api/market/losers?limit=5')
        const losersResult = await losersRes.json()
        setLosers(losersResult.data || losersResult)
      } catch (error) {
        console.error('Failed to fetch market data:', error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '--'
    return num.toLocaleString('en-IN')
  }

  const formatCurrency = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '--'
    if (num >= 10000000) return 'Rs. ' + (num / 10000000).toFixed(2) + ' Cr'
    if (num >= 100000) return 'Rs. ' + (num / 100000).toFixed(2) + ' L'
    return 'Rs. ' + num.toLocaleString('en-IN')
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
    <>
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">Your Portfolio at a Glance</h1>
          <p className="landing-hero-subtitle">
            Fast, minimal, bloatware-free portfolio tracking built only for Nepali stock investors.
            Focus on what matters—your holdings, your gains, and your growth.
          </p>
          <div className="landing-store-links">
            <a className="landing-store-link disabled" aria-disabled="true">
              <span className="landing-store-icon"><i className="fa-brands fa-google-play"></i></span>
              <div>
                <div className="landing-store-label">Coming soon</div>
                <div className="landing-store-name">Google Play</div>
              </div>
            </a>
            <a className="landing-store-link disabled" aria-disabled="true">
              <span className="landing-store-icon"><i className="fa-brands fa-apple"></i></span>
              <div>
                <div className="landing-store-label">Coming soon</div>
                <div className="landing-store-name">App Store</div>
              </div>
            </a>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-floating-card card-1">
            <div className="landing-card-header">Your Portfolio</div>
            <div className="landing-card-value">Rs. 2.5M</div>
            <div className="landing-card-change positive">↑ 15.8%</div>
          </div>
          <div className="landing-floating-card card-2">
            <div className="landing-card-header">Holdings</div>
            <div className="landing-card-value">12</div>
            <div className="landing-card-change">Stocks</div>
          </div>
          <div className="landing-floating-card card-3">
            <div className="landing-card-header">Today's Gain</div>
            <div className="landing-card-value">Rs. 8.5K</div>
            <div className="landing-card-change positive">↑ 0.34%</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <h2>Simplicity That Matters</h2>
          <p>Everything you need, nothing you don't</p>
        </div>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><i className="fa-solid fa-chart-column"></i></div>
            <h3>Quick Glance</h3>
            <p>See your portfolio value, gains, and holdings at a quick glance. No clutter, just clarity.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><i className="fa-solid fa-briefcase"></i></div>
            <h3>Multiple Portfolios</h3>
            <p>Organize your investments across different portfolios and track them all in one place.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
            <h3>Beautiful Widgets</h3>
            <p>Use beautiful in-app widgets to monitor your portfolio at a glance.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><i className="fa-solid fa-mobile-screen-button"></i></div>
            <h3>Mobile & Web</h3>
            <p>Access your portfolios seamlessly on mobile and web. Synchronized in real-time.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><i className="fa-solid fa-bell"></i></div>
            <h3>Stay Informed</h3>
            <p>Get notifications on your portfolio performance without the noise of market data.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><i className="fa-solid fa-bolt"></i></div>
            <h3>Lightning Fast</h3>
            <p>Minimal design means lightning-fast load times. Your data, instantly.</p>
          </div>
        </div>
      </section>

      {/* Market Widget Section */}
      <section id="market-widget" style={{ padding: '5rem 2rem', background: 'linear-gradient(180deg, #f5f7fa 0%, #fff 100%)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="landing-section-header">
            <h2>Live Market Data</h2>
            <p>Real-time NEPSE market index, top gainers and losers</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
            {/* Market Overview */}
            <div style={{ background: '#fff', borderRadius: 15, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Market Overview</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`landing-ticker-status ${status.class}`}></span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>{status.text}</span>
                </div>
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#1a472a' }}>
                    {idx ? formatNumber(idx.nepse_index) : '--'}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: (idx?.change || 0) >= 0 ? '#2d9f6f' : '#d62828' }}>
                    {idx ? `${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.change).toFixed(2)} (${Math.abs(idx.percentage_change).toFixed(2)}%)` : '--'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.75rem', marginBottom: '1rem' }}>
                  Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Turnover</span><br /><strong>{idx ? formatCurrency(idx.total_turnover) : '--'}</strong></div>
                  <div><span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Traded Shares</span><br /><strong>{idx ? formatNumber(idx.total_traded_shares) : '--'}</strong></div>
                  <div><span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Advanced</span><br /><strong style={{ color: '#2d9f6f' }}>{idx?.advanced || '--'}</strong></div>
                  <div><span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase' }}>Declined</span><br /><strong style={{ color: '#d62828' }}>{idx?.declined || '--'}</strong></div>
                </div>
              </div>
            </div>

            {/* Top Movers */}
            <div style={{ background: '#fff', borderRadius: 15, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 100%)', color: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Top Movers</h3>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setActiveTab('gainers')}
                  style={{
                    flex: 1, padding: '1rem', border: 'none', cursor: 'pointer',
                    background: activeTab === 'gainers' ? '#fff' : '#f5f7fa',
                    color: activeTab === 'gainers' ? '#1a472a' : '#6b7280',
                    fontWeight: 600, borderBottom: activeTab === 'gainers' ? '2px solid #52b788' : 'none'
                  }}
                >
                  <i className="fa-solid fa-arrow-trend-up"></i> Gainers
                </button>
                <button
                  onClick={() => setActiveTab('losers')}
                  style={{
                    flex: 1, padding: '1rem', border: 'none', cursor: 'pointer',
                    background: activeTab === 'losers' ? '#fff' : '#f5f7fa',
                    color: activeTab === 'losers' ? '#1a472a' : '#6b7280',
                    fontWeight: 600, borderBottom: activeTab === 'losers' ? '2px solid #52b788' : 'none'
                  }}
                >
                  <i className="fa-solid fa-arrow-trend-down"></i> Losers
                </button>
              </div>
              <div>
                {(activeTab === 'gainers' ? gainers : losers).map((stock, i) => (
                  <div key={i} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{stock.symbol}</div>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Rs. {formatNumber(stock.close_price || stock.closePrice || stock.ltp || 0)}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: activeTab === 'gainers' ? '#2d9f6f' : '#d62828' }}>
                      {activeTab === 'gainers' ? '↑' : '↓'} {Math.abs(stock.percentage_change || stock.percentageChange || 0).toFixed(2)}%
                    </div>
                  </div>
                ))}
                {(activeTab === 'gainers' ? gainers : losers).length === 0 && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Showcase */}
      <section id="app-showcase" style={{ padding: '5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="landing-section-header">
            <h2>Experience the App</h2>
            <p>Clean, intuitive interface designed for simplicity</p>
          </div>
        </div>
      </section>
    </>
  )
}
