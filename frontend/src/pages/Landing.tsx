import { Link } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
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

interface Sector {
  sector_name: string
  nepali_sector_name?: string
  company_count: number
  total_market_cap: number
  avg_price_change: number
  sector_percentage_change: number
  total_volume: number
  total_turnover: number
  gainers: number
  losers: number
  unchanged: number
}

interface IPO {
  symbol: string
  company_name: string
  offering_type: string
  units: number
  price_per_unit: number
  opening_date: string
  closing_date: string
  status: string
}

interface Dividend {
  symbol: string
  company_name: string
  fiscal_year: string
  bonus_share: number
  cash_dividend: number
  total_dividend: number
  book_close_date: string
}

interface MarketHistoryData {
  time: string
  value: number
}

const MarketChart = ({ data }: { data: MarketHistoryData[] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      timeScale: {
        visible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#2563eb',
      topColor: 'rgba(37, 99, 235, 0.2)',
      bottomColor: 'rgba(37, 99, 235, 0.0)',
      lineWidth: 2,
    })

    areaSeries.setData(data)
    chart.timeScale().fitContent()

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data])

  return <div ref={chartContainerRef} className="market-overview-chart" />
}

export default function LandingPage() {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [marketHistory, setMarketHistory] = useState<MarketHistoryData[]>([])
  const [gainers, setGainers] = useState<StockItem[]>([])
  const [losers, setLosers] = useState<StockItem[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [ipos, setIpos] = useState<IPO[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers')
  const [showBetaModal, setShowBetaModal] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [marketRes, historyRes, gainersRes, losersRes, sectorsRes, iposRes, dividendsRes] = await Promise.all([
          fetch('/api/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: [] })
          }),
          fetch('/api/market/indices/history?symbol=NEPSE&range=1M'),
          fetch('/api/market/gainers?limit=5'),
          fetch('/api/market/losers?limit=5'),
          fetch('/api/market/sectors'),
          fetch('/api/ipos?limit=5'),
          fetch('/api/announced-dividends?limit=5')
        ])

        const marketResult = await marketRes.json()
        const historyResult = await historyRes.json()
        const gainersResult = await gainersRes.json()
        const losersResult = await losersRes.json()
        const sectorsResult = await sectorsRes.json()
        const iposResult = await iposRes.json()
        const dividendsResult = await dividendsRes.json()

        setMarketData(marketResult.data || marketResult)

        const historyData = historyResult.data || []
        setMarketHistory(historyData.map((h: any) => ({
          time: (h.business_date || '').split('T')[0],
          value: parseFloat(h.closing_index)
        })))

        setGainers(gainersResult.data || gainersResult)
        setLosers(losersResult.data || losersResult)
        setSectors(sectorsResult.data?.sectors || sectorsResult.sectors || [])
        setIpos(iposResult.data || iposResult)
        setDividends(dividendsResult.data || dividendsResult)
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

  const currentUrl = 'https://nepseportfoliotracker.app'
  const siteName = 'Nepse Portfolio Tracker'
  const siteDescription = 'Real-time Nepal Stock Exchange (NEPSE) portfolio tracker with live market data, AI-powered stock analysis, sector performance, IPO updates, and dividend tracking. Track your investments with the fastest and most accurate NEPSE data.'
  const keywords = 'NEPSE, Nepal Stock Exchange, stock portfolio tracker, NEPSE live data, Nepal stocks, share market Nepal, NEPSE index, stock analysis Nepal, dividend tracker, IPO Nepal, sector analysis NEPSE, real-time stock prices Nepal, Nepali share market'

  return (
    <div className="landing-page-container">
      <Helmet>
        {/* Primary Meta Tags */}
        <title>NEPSE Portfolio Tracker - Real-Time Nepal Stock Market Data & Analysis</title>
        <meta name="title" content="NEPSE Portfolio Tracker - Real-Time Nepal Stock Market Data & Analysis" />
        <meta name="description" content={siteDescription} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={currentUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:title" content="NEPSE Portfolio Tracker - Real-Time Nepal Stock Market Data" />
        <meta property="og:description" content={siteDescription} />
        <meta property="og:image" content={`${currentUrl}/og-image.png`} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={currentUrl} />
        <meta name="twitter:title" content="NEPSE Portfolio Tracker - Real-Time Nepal Stock Market Data" />
        <meta name="twitter:description" content={siteDescription} />
        <meta name="twitter:image" content={`${currentUrl}/og-image.png`} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Nepse Portfolio" />
        <meta name="geo.region" content="NP" />
        <meta name="geo.placename" content="Nepal" />

        {/* Structured Data - Organization */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": siteName,
            "url": currentUrl,
            "description": siteDescription,
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web, Android",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "NPR"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "150"
            },
            "author": {
              "@type": "Organization",
              "name": "Nepse Portfolio",
              "url": currentUrl
            }
          })}
        </script>

        {/* Structured Data - Financial Service */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialService",
            "name": siteName,
            "description": siteDescription,
            "url": currentUrl,
            "areaServed": {
              "@type": "Country",
              "name": "Nepal"
            },
            "serviceType": "Stock Market Portfolio Tracking"
          })}
        </script>

        {/* Breadcrumb */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": currentUrl
              }
            ]
          })}
        </script>
      </Helmet>
      {/* Beta Installation Modal */}
      {showBetaModal && (
        <div className="beta-modal-overlay" onClick={() => setShowBetaModal(false)}>
          <div className="beta-modal" onClick={(e) => e.stopPropagation()}>
            <div className="beta-modal-header">
              <h2><i className="fa-brands fa-android"></i> Android Release (Beta)</h2>
              <button className="beta-modal-close" onClick={() => setShowBetaModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="beta-modal-content">
              <p className="beta-modal-intro">
                Follow these steps to join the closed beta testing and install the app:
              </p>

              <div className="beta-step">
                <div className="beta-step-number">1</div>
                <div className="beta-step-content">
                  <h3>Join the Google Group</h3>
                  <p>Request access to the closed testers group</p>
                  <a
                    href="https://groups.google.com/search?q=nepse-portfolio-closed-testers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="beta-step-link"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    Open Google Group
                  </a>
                </div>
              </div>

              <div className="beta-step">
                <div className="beta-step-number">2</div>
                <div className="beta-step-content">
                  <h3>Become a Tester</h3>
                  <p>Accept the tester invitation on the web</p>
                  <a
                    href="https://play.google.com/apps/testing/com.ashok.nepseportfoliotracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="beta-step-link"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    Join Beta Program
                  </a>
                </div>
              </div>

              <div className="beta-step">
                <div className="beta-step-number">3</div>
                <div className="beta-step-content">
                  <h3>Download the App</h3>
                  <p>Install from Play Store after becoming a tester</p>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.ashok.nepseportfoliotracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="beta-step-link"
                  >
                    <i className="fa-brands fa-google-play"></i>
                    Open Play Store
                  </a>
                </div>
              </div>

              <div className="beta-step">
                <div className="beta-step-number">4</div>
                <div className="beta-step-content">
                  <h3>Leave a Review</h3>
                  <p>Help us improve by sharing your feedback</p>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.ashok.nepseportfoliotracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="beta-step-link"
                  >
                    <i className="fa-solid fa-star"></i>
                    Rate the App
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market Data & Dashboard Section - NOW AT TOP */}
      <section id="market-dashboard" className="market-dashboard-section">
        <div className="dashboard-grid">
          {/* Main Column - Left */}
          <div className="dashboard-main">
            {/* Market Overview Card */}
            <div className="dashboard-card market-overview-card">
              <div className="card-header">
                <h3><i className="fa-solid fa-chart-line"></i> Market Overview</h3>
                <div className="market-status-indicator">
                  <span className={`status-dot ${status.class}`}></span>
                  <span className="status-text">{status.text}</span>
                </div>
              </div>
              <div className="card-body">
                <div className="market-overview-content">
                  <div className="index-main-display">
                    <div className="index-value">
                      {idx ? formatNumber(idx.nepse_index) : '--'}
                    </div>
                    <div className={`index-change ${(idx?.change || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {idx ? `${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.change).toFixed(2)} (${Math.abs(idx.percentage_change).toFixed(2)}%)` : '--'}
                    </div>
                  </div>
                  <MarketChart data={marketHistory} />
                </div>
                <div className="market-stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Turnover</span>
                    <span className="stat-value">{idx ? formatCurrency(idx.total_turnover) : '--'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Shares Traded</span>
                    <span className="stat-value">{idx ? formatNumber(idx.total_traded_shares) : '--'}</span>
                  </div>
                  <div className="stat-item stat-success">
                    <span className="stat-label">Advanced</span>
                    <span className="stat-value">{idx?.advanced || '--'}</span>
                  </div>
                  <div className="stat-item stat-danger">
                    <span className="stat-label">Declined</span>
                    <span className="stat-value">{idx?.declined || '--'}</span>
                  </div>
                </div>
                <div className="last-updated">
                  Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Sector Performance - Heatmap Design */}
            <div className="dashboard-card sectors-card">
              <div className="card-header">
                <h3><i className="fa-solid fa-layer-group"></i> Sector Heatmap</h3>
              </div>
              <div className="card-body">
                <div className="sector-heatmap-grid">
                  {sectors.map((sector, i) => {
                    const change = sector.sector_percentage_change || 0;
                    const intensity = Math.min(Math.abs(change) * 0.4, 0.9);
                    const bgColor = change >= 0
                      ? `rgba(45, 159, 111, ${0.1 + intensity})`
                      : `rgba(214, 40, 40, ${0.1 + intensity})`;

                    return (
                      <div key={i} className="heatmap-block" style={{ backgroundColor: bgColor }}>
                        <span className="heatmap-name">{sector.sector_name}</span>
                        <span className="heatmap-val">{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Side Column - Right */}
          <div className="dashboard-sidebar">
            <div className="dashboard-card movers-card">
              <div className="tab-switcher">
                <button
                  className={activeTab === 'gainers' ? 'active' : ''}
                  onClick={() => setActiveTab('gainers')}
                >
                  <i className="fa-solid fa-arrow-trend-up"></i> Top Gainers
                </button>
                <button
                  className={activeTab === 'losers' ? 'active' : ''}
                  onClick={() => setActiveTab('losers')}
                >
                  <i className="fa-solid fa-arrow-trend-down"></i> Top Losers
                </button>
              </div>
              <div className="card-body no-padding">
                {(activeTab === 'gainers' ? gainers : losers).map((stock, i) => (
                  <Link
                    key={i}
                    to="/script/$symbol"
                    params={{ symbol: stock.symbol }}
                    className="mover-item"
                  >
                    <div className="mover-symbol">{stock.symbol}</div>
                    <div className="mover-details">
                      <span className="mover-price">Rs. {formatNumber(stock.close_price || stock.closePrice || stock.ltp || 0)}</span>
                      <span className={`mover-change ${activeTab === 'gainers' ? 'positive' : 'negative'}`}>
                        {activeTab === 'gainers' ? '↑' : '↓'} {Math.abs(stock.percentage_change || stock.percentageChange || 0).toFixed(2)}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="dashboard-card data-card">
              <div className="card-header">
                <h3><i className="fa-solid fa-calendar-check"></i> Recent IPOs</h3>
              </div>
              <div className="card-body no-padding">
                {ipos.length > 0 ? ipos.slice(0, 3).map((ipo, i) => (
                  <div key={i} className="list-item">
                    <div className="item-title">{ipo.company_name}</div>
                    <div className="item-meta">
                      <span className="badge">{ipo.offering_type.toUpperCase()}</span>
                      <span className="date">{ipo.opening_date}</span>
                    </div>
                  </div>
                )) : <div className="empty-state">No IPO data available</div>}
              </div>
            </div>

            {/* Latest Dividends Widget */}
            <div className="dashboard-card data-card">
              <div className="card-header">
                <h3><i className="fa-solid fa-coins"></i> Latest Dividends</h3>
              </div>
              <div className="card-body no-padding">
                {dividends.length > 0 ? dividends.slice(0, 3).map((div, i) => (
                  <div key={i} className="list-item">
                    <div className="item-title">{div.symbol} ({div.fiscal_year})</div>
                    <div className="item-meta">
                      <span className="dividend-val bonus">B: {div.bonus_share}%</span>
                      <span className="dividend-val cash">C: {div.cash_dividend}%</span>
                    </div>
                  </div>
                )) : <div className="empty-state">No dividend data available</div>}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Hero Section - NOW SECONDARY */}
      <section className="landing-hero secondary">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">Track Like a Pro</h1>
          <p className="landing-hero-subtitle">
            While you're here, why not check our mobile app? It's the simplest way to track your portfolio on the go.
          </p>
          <div className="landing-store-links">
            <button className="landing-store-link beta" onClick={() => setShowBetaModal(true)}>
              <span className="landing-store-icon"><i className="fa-brands fa-google-play"></i></span>
              <div>
                <div className="landing-store-label">Join Beta</div>
                <div className="landing-store-name">Google Play</div>
              </div>
            </button>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-floating-card card-1">
            <div className="landing-card-header">Live Updates</div>
            <div className="landing-card-value">Instant</div>
            <div className="landing-card-change positive">No Refresh</div>
          </div>
          <div className="landing-floating-card card-2">
            <div className="landing-card-header">Simple UX</div>
            <div className="landing-card-value">Minimal</div>
            <div className="landing-card-change">Bloatware Free</div>
          </div>
          <div className="landing-floating-card card-3">
            <div className="landing-card-header">Join Testing</div>
            <div className="landing-card-value">Beta</div>
            <div className="landing-card-change positive">Open Access</div>
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

      {/* App Showcase */}
      <section id="app-showcase" style={{ padding: '5rem 2rem', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="landing-section-header">
            <h2>Experience the App</h2>
            <p>Clean, intuitive interface designed for simplicity</p>
          </div>

          <div className="landing-showcase-container">
            {[
              { img: 'Portfolio.webp', label: 'Portfolio Overview' },
              { img: 'Profit.webp', label: 'Profit & Loss' },
              { img: 'Analyze.webp', label: 'In-depth Analytics' },
              { img: 'Alerts.webp', label: 'Smart Alerts' },
              { img: 'Calendar.webp', label: 'Dividend Calendar' },
              { img: 'Import.webp', label: 'Easy Import' },
              { img: 'Backup.webp', label: 'Secure Backup' },
              { img: 'Widget Screen.webp', label: 'Live Widgets' }
            ].map((item, i) => (
              <div key={i} className="landing-showcase-item">
                <div className="landing-showcase-phone">
                  <img
                    src={`/screens/${item.img}`}
                    alt={item.label}
                    className="landing-showcase-image"
                    loading="lazy"
                  />
                </div>
                <div className="landing-showcase-caption">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
