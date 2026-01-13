import { useEffect, useState, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import { DashboardCard } from '../components/DashboardCard'
// import '../styles/script-detail.css'

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
      height: window.innerWidth < 768 ? 300 : 400,
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#2d9f6f',
      topColor: 'rgba(45, 159, 111, 0.3)',
      bottomColor: 'rgba(45, 159, 111, 0.05)',
      lineWidth: 3,
    })

    areaSeries.setData(data)
    chart.timeScale().fitContent()
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

        if (historyRes.success && Array.isArray(historyRes.data)) {
          const formattedHistory = historyRes.data.map((d: any) => ({
            time: d.business_date ? d.business_date.split('T')[0] : d.time,
            value: parseFloat(d.close_price || d.close || d.value)
          })).sort((a: any, b: any) => a.time.localeCompare(b.time))
          setHistory(formattedHistory)
        } else if (Array.isArray(historyRes)) {
          // Fallback for backward compatibility if API changes
          const formattedHistory = historyRes.map((d: any) => ({
            time: d.business_date ? d.business_date.split('T')[0] : d.time,
            value: parseFloat(d.close_price || d.close || d.value)
          })).sort((a: any, b: any) => a.time.localeCompare(b.time))
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

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${symbol} - ${companyName} | Nepse Portfolio`,
          text: `Check out ${companyName} (${symbol}) stock price and AI analysis on Nepse Portfolio Tracker.`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
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
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-nepse-primary/5 rounded-2xl flex items-center justify-center text-nepse-primary text-xl md:text-2xl font-black">
              {symbol?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black text-nepse-primary tracking-tight">{symbol}</h1>
                <button
                  onClick={handleShare}
                  className="p-2 text-gray-400 hover:text-nepse-primary transition-colors"
                  title="Share"
                >
                  <i className="fa-solid fa-share-nodes"></i>
                </button>
              </div>
              <div className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none">{companyName}</div>
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
            <div className="text-2xl md:text-4xl font-black text-nepse-primary tracking-tighter">
              Rs. {formatNumber(ltp)}
            </div>
            <div className={`flex items-center gap-1.5 md:gap-2 px-3 py-1 rounded-full text-xs md:text-sm font-black ${change >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              <i className={`fa-solid ${change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
              {Math.abs(change).toFixed(2)} ({Math.abs(pctChange).toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Chart Card */}
          <DashboardCard
            title="Technical Chart"
            icon="fa-solid fa-chart-line"
            noPadding
            extraHeader={
              <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
                {['1W', '1M', '3M', '6M', '1Y'].map((r) => (
                  <button
                    key={r}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${range === r ? 'bg-white text-nepse-primary' : 'text-white/70 hover:text-white'}`}
                    onClick={() => setRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            }
          >
            <div className="w-full">
              <Chart data={history} />
            </div>
          </DashboardCard>

          {/* AI Analysis */}
          <DashboardCard
            title="AI Analysis"
            icon="fa-solid fa-wand-magic-sparkles"
          >
            <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
              {aiSummary ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{aiSummary}</div>
              ) : (
                <div className="flex flex-col gap-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-full"></div>
                  <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                </div>
              )}
            </div>
          </DashboardCard>

          {/* Financial Performance */}
          {financials.length > 0 && (
            <DashboardCard
              title="Financial Performance"
              icon="fa-solid fa-table"
              noPadding
            >
              <div className="divide-y divide-gray-100">
                {Array.from(new Set(financials.map((f: any) => f.fiscal_year))).sort().reverse().map((year: any) => (
                  <div key={year} className="p-6 md:p-8">
                    <h4 className="text-sm font-black text-nepse-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-nepse-accent rounded-full"></span> {year}
                    </h4>
                    <div className="overflow-x-auto -mx-6 md:-mx-8">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50">
                            <th className="px-6 md:px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Quarter</th>
                            <th className="px-6 md:px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">EPS</th>
                            <th className="px-6 md:px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">NWPS</th>
                            <th className="px-6 md:px-8 py-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {financials
                            .filter((f: any) => f.fiscal_year === year)
                            .sort((a: any, b: any) => {
                              const quarters = { 'First Quarter': 1, 'Second Quarter': 2, 'Third Quarter': 3, 'Fourth Quarter': 4 };
                              return (quarters[a.quarter as keyof typeof quarters] || 0) - (quarters[b.quarter as keyof typeof quarters] || 0);
                            })
                            .map((report: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 md:px-8 py-4 text-xs font-bold text-gray-600 truncate max-w-[100px]">{report.quarter?.replace(' Quarter', '')}</td>
                                <td className="px-6 md:px-8 py-4 text-xs font-black text-nepse-primary">{report.earnings_per_share || '--'}</td>
                                <td className="px-6 md:px-8 py-4 text-xs font-black text-nepse-primary">{report.net_worth_per_share || '--'}</td>
                                <td className="px-6 md:px-8 py-4 text-xs font-black text-nepse-primary">{formatCurrency(report.net_profit)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Key Metrics */}
          <DashboardCard
            title="Key Metrics"
            icon="fa-solid fa-circle-info"
            noPadding
          >
            <div className="divide-y divide-gray-50">
              {[
                { label: 'Market Cap', value: formatCurrency(details.market_capitalization) },
                { label: 'Sector', value: details.sector_name || details.nepali_sector_name || '--' },
                { label: 'Open Price', value: `Rs. ${formatNumber(details.open_price)}` },
                { label: 'Day\'s High', value: `Rs. ${formatNumber(details.high_price)}` },
                { label: 'Day\'s Low', value: `Rs. ${formatNumber(details.low_price)}` },
                { label: 'Total Volume', value: formatNumber(details.total_traded_quantity || details.volume) },
                { label: 'Prev Close', value: `Rs. ${formatNumber(details.previous_close || details.prev_close)}` },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 md:p-6 hover:bg-gray-50/50 transition-colors">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.label}</span>
                  <span className="text-sm font-black text-nepse-primary">{item.value}</span>
                </div>
              ))}
            </div>
          </DashboardCard>

          {/* Dividends */}
          <DashboardCard
            title="Dividends"
            icon="fa-solid fa-bullhorn"
            noPadding
          >
            {dividends.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {dividends.map((div: any, i: number) => (
                  <div key={i} className="p-4 md:p-6 hover:bg-gray-50/50 transition-colors flex items-center justify-between">
                    <div className="text-sm font-black text-nepse-primary">{div.fiscal_year}</div>
                    <div className="flex gap-2">
                      {parseFloat(div.bonus_shares || 0) > 0 && (
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">B: {div.bonus_shares}%</span>
                      )}
                      {parseFloat(div.cash_dividend || 0) > 0 && (
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">C: {div.cash_dividend}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest italic leading-relaxed">No dividend data recorded.</p>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
