import { useEffect, useState, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import { DashboardCard } from '../components/DashboardCard'
import { slugify } from '../lib/stock-utils'
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
  const { slug } = useParams({ strict: false }) as any
  const symbol = slug?.split('-')[0].toUpperCase()
  // Extract company name from slug if possible (fallback for initial render)
  const slugName = slug?.split('-').slice(1).join(' ').replace(/-/g, ' ') || ''

  const [details, setDetails] = useState<any>(null)
  const [history, setHistory] = useState<HistoryData[]>([])
  const [range, setRange] = useState('1M')
  const [loading, setLoading] = useState(true)
  const [financials, setFinancials] = useState<any[]>([])
  const [dividends, setDividends] = useState<any[]>([])

  useEffect(() => {
    const fetchDetails = async () => {
      if (!symbol) return
      setLoading(true)
      try {
        const res = await fetch(`/api/scripts/${symbol}`)
        const data = await res.json()

        if (data.success) {
          setDetails(data.data)
          setDividends(data.data.dividends || [])
          setFinancials(data.data.financials || [])
        }
      } catch (error) {
        console.error('Error fetching details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetails()
  }, [symbol])

  useEffect(() => {
    const fetchHistory = async () => {
      // Prefer security_id if available (from details), otherwise fallback to symbol
      // But for symbols with slashes (e.g. GBILD84/85), we MUST use security_id
      const identifier = details?.security_id || symbol

      if (!identifier) return

      // If we have details but no security_id (rare/impossible?), fallback to symbol.
      // If we don't have details yet, we could wait, or try symbol. 
      // To strictly fix the bug, we should probably wait for details if we suspect a problematic symbol.
      // But practically, 'details' will be null initially. 
      // If we try fetching with symbol 'GBILD84/85' it will fail (404/500).
      // So checking if details is loaded is better.
      if (!details && !symbol) return

      // If we don't have details yet, use symbol. If symbol has '/', the fetch might fail or return error.
      // The previous implementation did Promise.all, so it TRIED to fetch with symbol.
      // We want to avoid that for broken symbols.
      // So if details is not null, use security_id.
      // If details IS null, should we wait?
      // If we wait, the chart will be empty for a second.
      // Let's rely on identifier.

      try {
        const res = await fetch(`/api/history/${identifier}?range=${range}`)
        const historyRes = await res.json()

        if (historyRes.success && Array.isArray(historyRes.data)) {
          const formattedHistory = historyRes.data.map((d: any) => ({
            time: d.business_date ? d.business_date.split('T')[0] : d.time,
            value: parseFloat(d.close_price || d.close || d.value)
          })).sort((a: any, b: any) => a.time.localeCompare(b.time))
          setHistory(formattedHistory)
        } else if (Array.isArray(historyRes)) {
          const formattedHistory = historyRes.map((d: any) => ({
            time: d.business_date ? d.business_date.split('T')[0] : d.time,
            value: parseFloat(d.close_price || d.close || d.value)
          })).sort((a: any, b: any) => a.time.localeCompare(b.time))
          setHistory(formattedHistory)
        }
      } catch (error) {
        console.error('Error fetching history:', error)
      }
    }

    fetchHistory()
  }, [details, symbol, range])

  // Split AI fetching to avoid blocking the main UI
  // useEffect(() => {
  //   const fetchAiData = async () => {
  //     const sym = symbol
  //     if (!sym) return
  //     setAiSummary(null)
  //     try {
  //       const aiRes = await fetch(`/api/scripts/${sym}/ai-summary`).then(res => res.json())
  //       if (aiRes.success) {
  //         setAiSummary(aiRes.data.ai_summary)
  //       }
  //     } catch (error) {
  //       setAiSummary("AI summary currently unavailable.")
  //     }
  //   }
  //   fetchAiData()
  // }, [symbol])



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

  // Use details if available, otherwise fallback to slug data for SEO
  const ltp = details?.ltp || details?.last_traded_price || 0
  const change = details?.price_change || 0
  const pctChange = details?.percentage_change || 0
  const companyName = details?.company_name || details?.name || slugName || symbol
  const sectorName = details?.sector_name || details?.nepali_sector_name || 'Stock Market'

  const currentSlug = `${symbol}-${slugify(companyName)}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${symbol} - ${companyName} | Nepse Portfolio`,
          text: `Check out ${companyName} (${symbol}) stock price and analysis on Nepse Portfolio Tracker.`,
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

  // Initial SEO Meta Tags (Rendered immediately)
  // We render Helmet here to ensure title/meta exists even during loading state
  const MetaTags = () => (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{`${symbol} Stock Price - ${companyName} Live Chart, Analysis & Financials | NEPSE`}</title>
      <meta name="title" content={`${symbol} Stock Price - ${companyName} Live Chart & Analysis`} />
      <meta name="description" content={`Live stock price of ${companyName} (${symbol}) is Rs. ${ltp ? formatNumber(ltp) : '...'}. ${ltp ? `Has ${change >= 0 ? 'gained' : 'lost'} ${Math.abs(change).toFixed(2)} points today.` : ''} View real-time charts, technical analysis, dividend history, and financial reports for ${companyName} on Nepal Stock Exchange (NEPSE).`} />
      <meta name="keywords" content={`${symbol}, ${companyName}, ${symbol} share price, ${symbol} analysis, ${companyName} news, nepse ${symbol}, nepal stock market, ${symbol} dividend`} />
      <link rel="canonical" href={`https://nepseportfoliotracker.app/script/${currentSlug}`} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`https://nepseportfoliotracker.app/script/${currentSlug}`} />
      <meta property="og:title" content={`${symbol} - ${companyName} Stock Price & Analysis`} />
      <meta property="og:description" content={`Live price Rs. ${ltp ? formatNumber(ltp) : '...'} ${pctChange ? `(${pctChange.toFixed(2)}%)` : ''}. Get real-time charts, AI analysis, and financial data for ${companyName}.`} />
      <meta property="og:image" content={`https://nepseportfoliotracker.app/og-stock-${symbol}.png`} />
      <meta property="og:site_name" content="Nepse Portfolio Tracker" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={`https://nepseportfoliotracker.app/script/${currentSlug}`} />
      <meta name="twitter:title" content={`${symbol} - ${companyName} Stock Price`} />
      <meta name="twitter:description" content={`Rs. ${ltp ? formatNumber(ltp) : '...'} - Live charts & AI analysis for ${companyName}`} />
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
          "url": `https://nepseportfoliotracker.app/script/${currentSlug}`,
          "sameAs": [
            `https://merolagani.com/CompanyDetail.aspx?symbol=${symbol}`,
            `https://www.sharesansar.com/company/${symbol}`
          ]
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
              "item": "https://nepseportfoliotracker.app/stocks"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": symbol,
              "item": `https://nepseportfoliotracker.app/script/${currentSlug}`
            }
          ]
        })}
      </script>
    </Helmet>
  )

  if (loading && !details) {
    return (
      <>
        <MetaTags />
        <div className="min-h-screen bg-gray-50/50 flex flex-col justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nepse-primary mb-4"></div>
          <div className="text-gray-500 font-medium animate-pulse">Loading {symbol} details...</div>
        </div>
      </>
    )
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col justify-center items-center">
        <Helmet>
          <title>{`${symbol} - Not Found | Nepse Portfolio`}</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="text-xl font-bold text-gray-800 mb-2">Script not found</div>
        <p className="text-gray-500">We couldn't find any data for {symbol}.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <MetaTags />
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-[99px] md:top-[65px] z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-nepse-primary/5 rounded-2xl flex items-center justify-center text-nepse-primary text-xl md:text-2xl font-black">
              {symbol?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-col md:flex-row md:items-end gap-1 md:gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-nepse-primary tracking-tight">
                  {symbol} <span className="text-gray-400 font-bold text-lg md:text-xl align-middle hidden md:inline-block">-</span> <span className="text-lg md:text-xl font-bold text-gray-500 align-middle block md:inline">{companyName}</span>
                </h1>
                <button
                  onClick={handleShare}
                  className="p-1 mb-1 text-gray-400 hover:text-nepse-primary transition-colors hidden md:block"
                  title="Share"
                >
                  <i className="fa-solid fa-share-nodes"></i>
                </button>
              </div>
              <div className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">
                {sectorName} • NEPSE: {symbol}
              </div>
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
          {/* <DashboardCard
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
          </DashboardCard> */}

          {/* Financial Performance */}
          {financials.length > 0 && (
            <DashboardCard
              title="Financial Performance"
              icon="fa-solid fa-table"
              noPadding
            >
              <div className="divide-y divide-gray-100">
                {Array.from(new Set(financials.map((f: any) => f.fiscal_year))).sort().reverse().map((year: any) => (
                  <div key={year} className="border-b last:border-b-0 border-gray-100">
                    <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-2 border-b border-gray-100">
                      <span className="w-1.5 h-1.5 bg-nepse-primary rounded-full"></span>
                      <h4 className="text-xs font-black text-gray-700">{year}</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/4">Quarter</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-1/4">EPS</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-1/4">NWPS</th>
                            <th className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-1/4">Profit</th>
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
                              <tr key={i} className="hover:bg-gray-50 transition-colors even:bg-gray-50/30">
                                <td className="px-4 py-2.5 text-xs font-medium text-gray-600">
                                  {report.quarter?.replace(' Quarter', '')}
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold text-gray-800 text-right font-mono">
                                  {report.earnings_per_share || '--'}
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold text-gray-800 text-right font-mono">
                                  {report.net_worth_per_share || '--'}
                                </td>
                                <td className="px-4 py-2.5 text-xs font-bold text-nepse-primary text-right font-mono">
                                  {formatCurrency(report.net_profit).replace('Rs. ', '')}
                                </td>
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
            <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
              {[
                { label: 'Market Cap', value: formatCurrency(details.market_capitalization), icon: 'fa-coins' },
                { label: 'Sector', value: details.sector_name || details.nepali_sector_name || '--', icon: 'fa-industry' },
                { label: 'Open Price', value: `Rs. ${formatNumber(details.open_price)}`, icon: 'fa-door-open' },
                { label: 'Prev Close', value: `Rs. ${formatNumber(details.previous_close || details.prev_close)}`, icon: 'fa-clock-rotate-left' },
                { label: 'Day\'s High', value: `Rs. ${formatNumber(details.high_price)}`, icon: 'fa-arrow-trend-up', className: 'text-green-600' },
                { label: 'Day\'s Low', value: `Rs. ${formatNumber(details.low_price)}`, icon: 'fa-arrow-trend-down', className: 'text-red-600' },
                { label: 'Total Volume', value: formatNumber(details.total_traded_quantity || details.volume), icon: 'fa-chart-simple' },
              ].map((item, i) => (
                <div key={i} className="bg-white p-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded bg-gray-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                      <i className={`fa-solid ${item.icon} text-[10px] text-gray-400`}></i>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</span>
                  </div>
                  <div className={`text-sm font-black pl-7 ${item.className || 'text-nepse-primary'}`}>
                    {item.value}
                  </div>
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
              <div className="divide-y divide-gray-100">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fiscal Year</span>
                  <div className="flex gap-4">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16 text-right">Bonus</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16 text-right">Cash</span>
                  </div>
                </div>
                {dividends.map((div: any, i: number) => (
                  <div key={i} className="px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between even:bg-gray-50/30">
                    <div className="text-xs font-bold text-gray-700 font-mono">{div.fiscal_year}</div>
                    <div className="flex gap-4">
                      <div className="w-16 text-right">
                        {parseFloat(div.bonus_shares || 0) > 0 ? (
                          <span className="text-xs font-bold text-green-600 font-mono">{div.bonus_shares}%</span>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </div>
                      <div className="w-16 text-right">
                        {parseFloat(div.cash_dividend || 0) > 0 ? (
                          <span className="text-xs font-bold text-blue-600 font-mono">{div.cash_dividend}%</span>
                        ) : <span className="text-xs text-gray-300">-</span>}
                      </div>
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

          {/* About Company - SEO Content */}
          <DashboardCard
            title={`About ${companyName}`}
            icon="fa-solid fa-building"
          >
            <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
              <p>
                <strong>{companyName} ({symbol})</strong> is a publicly traded company listed on the Nepal Stock Exchange (NEPSE).
                The stock is currently trading at a price of <strong>Rs. {formatNumber(ltp)}</strong>, reflecting a
                <span className={change >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                  {' '}{change >= 0 ? 'gain' : 'loss'} of {Math.abs(change).toFixed(2)} ({Math.abs(pctChange).toFixed(2)}%)
                </span> from the previous close.
              </p>
              <p className="mt-2">
                Investors can view the latest live stock price, technical analysis charts, and financial reports for {symbol} on Nepse Portfolio Tracker.
                The detailed analysis includes earnings per share (EPS), P/E ratio, dividend history, and market capitalization, helping you make informed investment decisions in the {sectorName} sector.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2 text-xs">
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-500">#{symbol}</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-500">#{companyName.replace(/\s+/g, '')}</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-500">#NEPSE</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-500">#StockMarketNepal</span>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  )
}
