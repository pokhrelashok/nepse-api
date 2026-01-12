import { useEffect, useState, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import '../styles/script-detail.css'

interface HistoryData {
  time: string
  value: number
}

const Chart = ({ data }: { data: HistoryData[] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const handleResize = () => {
      chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth })
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#2d9f6f',
      topColor: 'rgba(45, 159, 111, 0.3)',
      bottomColor: 'rgba(45, 159, 111, 0.05)',
      lineWidth: 3,
    })

    areaSeries.setData(data)
    chartRef.current = chart

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data])

  return <div ref={chartContainerRef} style={{ width: '100%' }} />
}

export default function ScriptDetail() {
  const { symbol } = useParams({ strict: false }) as any
  const [details, setDetails] = useState<any>(null)
  const [history, setHistory] = useState<HistoryData[]>([])
  const [range, setRange] = useState('1M')
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [financials, setFinancials] = useState<any[]>([])
  const [dividends, setDividends] = useState<any[]>([])

  useEffect(() => {
    const fetchCoreData = async () => {
      const sym = symbol?.toUpperCase()
      if (!sym) return
      setLoading(true)
      try {
        const [detailsRes, historyRes] = await Promise.all([
          fetch(`/api/scripts/${sym}`).then(res => res.json()),
          fetch(`/api/history/${sym}?range=${range}`).then(res => res.json())
        ])

        if (detailsRes.success) {
          setDetails(detailsRes.data)
          // Also set dividends and financials from details if they exist
          setDividends(detailsRes.data.dividends || [])
          setFinancials(detailsRes.data.financials || [])
        }

        if (Array.isArray(historyRes)) {
          const formattedHistory = historyRes.map((d: any) => ({
            time: d.business_date ? d.business_date.split('T')[0] : d.time,
            value: parseFloat(d.close || d.value)
          })).sort((a, b) => a.time.localeCompare(b.time))
          setHistory(formattedHistory)
        }
      } catch (error) {
        console.error('Error fetching core data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCoreData()
  }, [symbol, range])

  // Split AI fetching to avoid blocking the main UI
  useEffect(() => {
    const fetchAiData = async () => {
      const sym = symbol?.toUpperCase()
      if (!sym) return
      setAiSummary(null)
      try {
        const aiRes = await fetch(`/api/scripts/${sym}/ai-summary`).then(res => res.json())
        if (aiRes.success) {
          setAiSummary(aiRes.data.ai_summary)
        }
      } catch (error) {
        setAiSummary("AI summary currently unavailable.")
      }
    }
    fetchAiData()
  }, [symbol])

  if (loading && !details) {
    return <div className="loading-state">Loading script details...</div>
  }

  if (!details) {
    return <div className="error-state">Script not found.</div>
  }

  const formatCurrency = (val: any) => {
    if (!val) return 'N/A'
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return 'N/A'
    if (num >= 10000000) return `Rs. ${(num / 10000000).toFixed(2)} Cr`
    if (num >= 100000) return `Rs. ${(num / 100000).toFixed(2)} Lk`
    return `Rs. ${num.toLocaleString()}`
  }

  const formatNumber = (val: any) => {
    if (!val) return '0.00'
    const num = typeof val === 'string' ? parseFloat(val) : val
    return isNaN(num) ? '0.00' : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const ltp = details.ltp || details.last_traded_price || 0
  const change = details.point_change || 0
  const pctChange = details.percentage_change || 0
  const companyName = details.company_name || details.name || symbol

  return (
    <div className="script-detail-container">
      <Helmet>
        {/* Primary Meta Tags */}
        <title>{`${symbol} Stock Price - ${companyName} Live Chart, Analysis & Financials | NEPSE`}</title>
        <meta name="title" content={`${symbol} Stock Price - ${companyName} Live Chart & Analysis`} />
        <meta name="description" content={`${symbol} (${companyName}) live stock price Rs. ${formatNumber(ltp)} with ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${pctChange.toFixed(2)}%) change. Real-time charts, AI-powered analysis, financial reports, dividend history, and key metrics for ${companyName} on Nepal Stock Exchange (NEPSE).`} />
        <meta name="keywords" content={`${symbol}, ${companyName}, ${symbol} stock price, ${symbol} NEPSE, ${companyName} share price, ${symbol} live price, ${symbol} chart, ${symbol} analysis, ${symbol} dividend, ${symbol} financials, Nepal stock ${symbol}`} />
        <link rel="canonical" href={`https://nepseportfoliotracker.app/script/${symbol}`} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://nepseportfoliotracker.app/script/${symbol}`} />
        <meta property="og:title" content={`${symbol} - ${companyName} Stock Price & Analysis`} />
        <meta property="og:description" content={`Live price Rs. ${formatNumber(ltp)} (${change >= 0 ? '+' : ''}${pctChange.toFixed(2)}%). Get real-time charts, AI analysis, and financial data for ${companyName}.`} />
        <meta property="og:image" content={`https://nepseportfoliotracker.app/og-stock-${symbol}.png`} />
        <meta property="og:site_name" content="Nepse Portfolio Tracker" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={`https://nepseportfoliotracker.app/script/${symbol}`} />
        <meta name="twitter:title" content={`${symbol} - ${companyName} Stock Price`} />
        <meta name="twitter:description" content={`Rs. ${formatNumber(ltp)} (${change >= 0 ? '+' : ''}${pctChange.toFixed(2)}%) - Live charts & AI analysis`} />
        <meta name="twitter:image" content={`https://nepseportfoliotracker.app/og-stock-${symbol}.png`} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow, max-image-preview:large" />

        {/* Structured Data - Stock */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Corporation",
            "name": companyName,
            "tickerSymbol": symbol,
            "description": `${companyName} (${symbol}) stock information and analysis on Nepal Stock Exchange`,
            "url": `https://nepseportfoliotracker.app/script/${symbol}`,
            "sameAs": [
              `https://merolagani.com/CompanyDetail.aspx?symbol=${symbol}`,
              `https://www.sharesansar.com/company/${symbol}`
            ]
          })}
        </script>

        {/* Structured Data - Financial Quote */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialProduct",
            "name": `${symbol} Stock`,
            "description": `${companyName} stock trading on Nepal Stock Exchange`,
            "provider": {
              "@type": "Organization",
              "name": "Nepal Stock Exchange (NEPSE)"
            },
            "offers": {
              "@type": "Offer",
              "price": ltp,
              "priceCurrency": "NPR",
              "availability": "https://schema.org/InStock"
            }
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
                "item": "https://nepseportfoliotracker.app"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Stocks",
                "item": "https://nepseportfoliotracker.app/#market-dashboard"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": symbol,
                "item": `https://nepseportfoliotracker.app/script/${symbol}`
              }
            ]
          })}
        </script>
      </Helmet>
      {/* Header */}
      <header className="script-header">
        <div className="script-title-area">
          <h1>{symbol}</h1>
          <div className="script-subtitle">{companyName}</div>
        </div>
        <div className="script-price-area">
          <div className="script-ltp">Rs. {formatNumber(ltp)}</div>
          <div className={`script-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)} ({Math.abs(pctChange).toFixed(2)}%)
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="script-main-grid">
        <div className="dashboard-main">
          {/* Chart Card */}
          <div className="dashboard-card script-chart-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-chart-line"></i> Technical Chart</h3>
              <div className="chart-ranges">
                {['1W', '1M', '3M', '6M', '1Y'].map((r) => (
                  <button
                    key={r}
                    className={`range-btn ${range === r ? 'active' : ''}`}
                    onClick={() => setRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              <Chart data={history} />
            </div>
          </div>

          {/* Financial Performance */}
          {financials.length > 0 && (
            <div className="dashboard-card financials-card" style={{ marginTop: '2rem' }}>
              <div className="card-header">
                <h3><i className="fa-solid fa-table"></i> Financial Performance</h3>
              </div>
              <div className="card-body">
                <div className="financials-grouped">
                  {Array.from(new Set(financials.map((f: any) => f.fiscal_year))).sort().reverse().map((year: any) => (
                    <div key={year} className="year-group">
                      <h4 className="year-title">{year}</h4>
                      <div className="table-responsive">
                        <table className="financial-table">
                          <thead>
                            <tr>
                              <th>Quarter</th>
                              <th>EPS</th>
                              <th>NWPS</th>
                              <th>Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financials
                              .filter((f: any) => f.fiscal_year === year)
                              .sort((a: any, b: any) => {
                                const quarters = { 'First Quarter': 1, 'Second Quarter': 2, 'Third Quarter': 3, 'Fourth Quarter': 4 };
                                return (quarters[a.quarter as keyof typeof quarters] || 0) - (quarters[b.quarter as keyof typeof quarters] || 0);
                              })
                              .map((report: any, i: number) => (
                                <tr key={i}>
                                  <td>{report.quarter?.replace(' Quarter', '')}</td>
                                  <td>{report.earnings_per_share || '--'}</td>
                                  <td>{report.net_worth_per_share || '--'}</td>
                                  <td>{formatCurrency(report.net_profit)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="dashboard-card ai-summary-card" style={{ marginTop: '2rem' }}>
            <div className="card-header">
              <h3><i className="fa-solid fa-wand-magic-sparkles"></i> AI Analysis</h3>
            </div>
            <div className="card-body">
              <div className="ai-summary-content">
                {aiSummary ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{aiSummary}</div>
                ) : (
                  <div className="ai-loading-placeholder">
                    <div className="ai-pulse-text"><i className="fa-solid fa-wand-magic-sparkles"></i> AI is analyzing {details?.symbol || 'stock'}...</div>
                    <div className="ai-skeleton-line"></div>
                    <div className="ai-skeleton-line short"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="script-info-sidebar">
          {/* Key Metrics */}
          <div className="dashboard-card info-card">
            <div className="card-header">
              <h3><i className="fa-solid fa-circle-info"></i> Key Metrics</h3>
            </div>
            <div className="card-body">
              <div className="data-row">
                <span className="data-label">Market Cap</span>
                <span className="data-value">{formatCurrency(details.market_capitalization)}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Sector</span>
                <span className="data-value">{details.sector_name || details.nepali_sector_name || '--'}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Open Price</span>
                <span className="data-value">Rs. {formatNumber(details.open_price)}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Days High</span>
                <span className="data-value">Rs. {formatNumber(details.high_price)}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Days Low</span>
                <span className="data-value">Rs. {formatNumber(details.low_price)}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Total Vol</span>
                <span className="data-value">{formatNumber(details.total_traded_quantity || details.volume)}</span>
              </div>
              <div className="data-row">
                <span className="data-label">Prev Close</span>
                <span className="data-value">Rs. {formatNumber(details.previous_close || details.prev_close)}</span>
              </div>
            </div>
          </div>

          {/* Dividends */}
          <div className="dashboard-card info-card" style={{ marginTop: '2rem' }}>
            <div className="card-header">
              <h3><i className="fa-solid fa-bullhorn"></i> Dividends</h3>
            </div>
            <div className="card-body">
              {dividends.length > 0 ? (
                <div className="dividend-list">
                  {dividends.map((div: any, i: number) => (
                    <div key={i} className="dividend-item">
                      <div className="div-year">{div.fiscal_year}</div>
                      <div className="div-values">
                        {parseFloat(div.bonus_shares || 0) > 0 && <span>B: {div.bonus_shares}%</span>}
                        {parseFloat(div.cash_dividend || 0) > 0 && <span>C: {div.cash_dividend}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-msg">No dividend data recorded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
