import { Link } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import { DashboardCard } from '../components/DashboardCard'

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

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  published_at: string;
  featured_image: string;
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
  const [articles, setArticles] = useState<Article[]>([])
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers')
  const [showBetaModal, setShowBetaModal] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [marketRes, historyRes, gainersRes, losersRes, sectorsRes, iposRes, dividendsRes, blogsRes] = await Promise.all([
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
          fetch('/api/announced-dividends?limit=5'),
          fetch('/api/blogs?limit=3')
        ])

        const marketResult = await marketRes.json()
        const historyResult = await historyRes.json()
        const gainersResult = await gainersRes.json()
        const losersResult = await losersRes.json()
        const sectorsResult = await sectorsRes.json()
        const iposResult = await iposRes.json()
        const dividendsResult = await dividendsRes.json()
        const blogsResult = await blogsRes.json()

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
        if (blogsResult.success) {
          setArticles(blogsResult.data.blogs || [])
        }
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
    <div className="min-h-screen bg-white">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowBetaModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold flex items-center gap-3 text-nepse-primary">
                <i className="fa-brands fa-android text-2xl"></i> Android Release (Beta)
              </h2>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" onClick={() => setShowBetaModal(false)}>
                <i className="fa-solid fa-xmark text-lg text-gray-400"></i>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-gray-600">
                Follow these steps to join the closed beta testing and install the app:
              </p>

              <div className="flex gap-4 group">
                <div className="shrink-0 w-8 h-8 rounded-full bg-nepse-primary/10 text-nepse-primary flex items-center justify-center font-bold text-sm">1</div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Join the Google Group</h3>
                  <p className="text-sm text-gray-500">Request access to the closed testers group</p>
                  <a
                    href="https://groups.google.com/search?q=nepse-portfolio-closed-testers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-nepse-primary hover:text-white rounded-xl text-sm font-semibold transition-all group-hover:bg-nepse-primary group-hover:text-white"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    Open Google Group
                  </a>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="shrink-0 w-8 h-8 rounded-full bg-nepse-primary/10 text-nepse-primary flex items-center justify-center font-bold text-sm">2</div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Become a Tester</h3>
                  <p className="text-sm text-gray-500">Accept the tester invitation on the web</p>
                  <a
                    href="https://play.google.com/apps/testing/com.ashok.nepseportfoliotracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-nepse-primary hover:text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    Join Beta Program
                  </a>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="shrink-0 w-8 h-8 rounded-full bg-nepse-primary/10 text-nepse-primary flex items-center justify-center font-bold text-sm">3</div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Download the App</h3>
                  <p className="text-sm text-gray-500">Install from Play Store after becoming a tester</p>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.ashok.nepseportfoliotracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-nepse-primary hover:text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    <i className="fa-brands fa-google-play"></i>
                    Open Play Store
                  </a>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="shrink-0 w-8 h-8 rounded-full bg-nepse-primary/10 text-nepse-primary flex items-center justify-center font-bold text-sm">4</div>
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900">Leave a Review</h3>
                  <p className="text-sm text-gray-500">Help us improve by sharing your feedback</p>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.ashok.nepseportfoliotracker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-nepse-primary hover:text-white rounded-xl text-sm font-semibold transition-all"
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

      {/* Market Data & Dashboard Section */}
      <section id="market-dashboard" className="py-12 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Main Column - Left */}
            <div className="lg:col-span-2 space-y-8">

              {/* Market Overview Card */}
              <DashboardCard
                title="Market Overview"
                icon="fa-solid fa-chart-line"
                noPadding
                extraHeader={
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20 backdrop-blur-sm">
                    <span className={`w-2 h-2 rounded-full ${status.class === 'open' ? 'bg-green-400 animate-pulse' : status.class === 'pre-open' ? 'bg-yellow-400' : 'bg-red-400'}`}></span>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{status.text}</span>
                  </div>
                }
                footer={`Last updated: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
              >
                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                      <div className="text-4xl md:text-5xl font-black text-nepse-primary tracking-tight">
                        {idx ? formatNumber(idx.nepse_index) : '--'}
                      </div>
                      <div className={`mt-2 flex items-center gap-2 text-lg font-bold ${(idx?.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {idx ? (
                          <>
                            <i className={`fa-solid ${idx.change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                            {Math.abs(idx.change).toFixed(2)} ({Math.abs(idx.percentage_change).toFixed(2)}%)
                          </>
                        ) : '--'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-[200px] mb-8 bg-gray-50/30">
                  <MarketChart data={marketHistory} />
                </div>

                <div className="p-6 md:p-8 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Turnover</div>
                      <div className="text-sm font-black text-nepse-primary">{idx ? formatCurrency(idx.total_turnover) : '--'}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Shares Traded</div>
                      <div className="text-sm font-black text-nepse-primary tracking-tight">{idx ? formatNumber(idx.total_traded_shares) : '--'}</div>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-green-600/60 uppercase tracking-widest mb-1">Advanced</div>
                      <div className="text-sm font-black text-green-600">{idx?.advanced || '--'} <i className="fa-solid fa-arrow-trend-up ml-1 opacity-50"></i></div>
                    </div>
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                      <div className="text-[10px] font-bold text-red-600/60 uppercase tracking-widest mb-1">Declined</div>
                      <div className="text-sm font-black text-red-600">{idx?.declined || '--'}</div>
                    </div>
                  </div>
                </div>
              </DashboardCard>

              {/* Sector Performance */}
              <DashboardCard
                title="Sector Heatmap"
                icon="fa-solid fa-layer-group"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {sectors.map((sector, i) => {
                    const change = sector.sector_percentage_change || 0;
                    const isPositive = change >= 0;
                    return (
                      <div
                        key={i}
                        className={`p-4 rounded-xl flex flex-col justify-between min-h-[100px] transition-transform hover:scale-[1.02] cursor-default border ${isPositive ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}
                      >
                        <span className="text-[10px] font-bold text-gray-500 line-clamp-2 leading-tight uppercase tracking-tight mb-2">
                          {sector.sector_name}
                        </span>
                        <span className={`text-lg font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </DashboardCard>
            </div>

            {/* Side Column - Right */}
            <div className="space-y-8">
              {/* Movers Card */}
              <DashboardCard
                title="Market Movers"
                icon="fa-solid fa-bolt"
                noPadding
                extraHeader={
                  <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
                    <button
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'gainers' ? 'bg-white text-green-600' : 'text-white/70 hover:text-white'}`}
                      onClick={() => setActiveTab('gainers')}
                    >
                      Gainers
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${activeTab === 'losers' ? 'bg-white text-red-600' : 'text-white/70 hover:text-white'}`}
                      onClick={() => setActiveTab('losers')}
                    >
                      Losers
                    </button>
                  </div>
                }
              >
                <div className="divide-y divide-gray-50">
                  {(activeTab === 'gainers' ? gainers : losers).map((stock, i) => (
                    <Link
                      key={i}
                      to="/script/$symbol"
                      params={{ symbol: stock.symbol }}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                    >
                      <div>
                        <div className="font-black text-nepse-primary group-hover:text-nepse-accent transition-colors">{stock.symbol}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Rs. {formatNumber(stock.close_price || stock.closePrice || stock.ltp || 0)}
                        </div>
                      </div>
                      <div className={`text-sm font-black px-3 py-1 rounded-lg ${activeTab === 'gainers' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {activeTab === 'gainers' ? '↑' : '↓'} {Math.abs(stock.percentage_change || stock.percentageChange || 0).toFixed(2)}%
                      </div>
                    </Link>
                  ))}
                </div>
              </DashboardCard>

              {/* Data Cards: IPOs & Dividends */}
              <div className="space-y-4">
                <DashboardCard
                  title="Recent IPOs"
                  icon="fa-solid fa-calendar-check"
                  noPadding
                  className="p-0"
                >
                  <div className="p-4 space-y-3">
                    {ipos.length > 0 ? ipos.slice(0, 3).map((ipo, i) => (
                      <div key={i} className="group p-3 hover:bg-nepse-primary/5 rounded-xl transition-colors border border-transparent hover:border-nepse-primary/10">
                        <div className="font-bold text-sm text-nepse-primary line-clamp-1">{ipo.company_name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-black text-nepse-accent uppercase tracking-widest">{ipo.offering_type}</span>
                          <span className="text-[10px] font-bold text-gray-400">{ipo.opening_date}</span>
                        </div>
                      </div>
                    )) : <div className="p-4 text-center text-xs text-gray-400 italic">No IPOs found</div>}
                  </div>
                </DashboardCard>

                <DashboardCard
                  title="Latest Dividends"
                  icon="fa-solid fa-coins"
                  noPadding
                  className="p-0"
                >
                  <div className="p-4 space-y-3">
                    {dividends.length > 0 ? dividends.slice(0, 3).map((div, i) => (
                      <div key={i} className="group p-3 hover:bg-nepse-primary/5 rounded-xl transition-colors border border-transparent hover:border-nepse-primary/10">
                        <div className="font-bold text-sm text-nepse-primary">{div.symbol} ({div.fiscal_year})</div>
                        <div className="flex gap-2 mt-1">
                          {div.bonus_share > 0 && <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">B: {div.bonus_share}%</span>}
                          {div.cash_dividend > 0 && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">C: {div.cash_dividend}%</span>}
                        </div>
                      </div>
                    )) : <div className="p-4 text-center text-xs text-gray-400 italic">No dividends found</div>}
                  </div>
                </DashboardCard>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* Hero Section - Secondary */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a472a] to-[#2d6a4f] text-white py-20 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-black leading-tight">
              Track Like a PRO
            </h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-xl mx-auto md:mx-0">
              Join thousands of investors using our platform to monitor their NEPSE portfolios with precision and ease.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <button
                onClick={() => setShowBetaModal(true)}
                className="group flex items-center gap-3 bg-white text-[#1a472a] px-8 py-4 rounded-2xl font-bold text-lg hover:bg-nepse-accent hover:text-white transition-all transform hover:-translate-y-1 shadow-xl hover:shadow-nepse-accent/20"
              >
                <div className="shrink-0 bg-[#1a472a] group-hover:bg-white p-2 rounded-lg transition-colors">
                  <i className="fa-brands fa-google-play text-white group-hover:text-[#1a472a]"></i>
                </div>
                <div className="text-left leading-none">
                  <div className="text-[10px] uppercase tracking-wider opacity-60">Get Beta on</div>
                  <div className="text-lg font-black tracking-tight">Play Store</div>
                </div>
              </button>
            </div>
          </div>
          <div className="flex-1 relative w-full max-w-lg aspect-square">
            <div className="absolute top-1/4 -left-4 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl animate-bounce-slow transform -rotate-6">
              <div className="text-xs font-bold text-gray-300 mb-1">Live Updates</div>
              <div className="text-2xl font-black">Instant</div>
              <div className="text-[10px] font-bold text-green-400 mt-1">No Refresh</div>
            </div>
            <div className="absolute bottom-1/4 -right-4 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl animate-bounce-slow delay-700 transform rotate-6">
              <div className="text-xs font-bold text-gray-300 mb-1">Simple UX</div>
              <div className="text-2xl font-black">Minimal</div>
              <div className="text-[10px] font-bold text-gray-300 mt-1">Bloatware Free</div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-3xl border border-white/20 p-8 rounded-[32px] shadow-2xl scale-125">
              <div className="text-xs font-bold text-gray-300 mb-1">Join Testing</div>
              <div className="text-4xl font-black">BETA</div>
              <div className="text-[10px] font-bold text-green-400 mt-2 uppercase tracking-widest">Open Access</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black text-nepse-primary tracking-tight">Simplicity That Matters</h2>
            <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-sm">Everything you need, nothing you don't</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-nepse-accent/20 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-nepse-accent text-2xl shadow-sm mb-6 group-hover:bg-nepse-accent group-hover:text-white transition-all">
                <i className="fa-solid fa-chart-column"></i>
              </div>
              <h3 className="text-xl font-black text-nepse-primary mb-3">Quick Glance</h3>
              <p className="text-gray-600 leading-relaxed">See your portfolio value, gains, and holdings at a quick glance. No clutter, just clarity.</p>
            </div>
            <div className="p-8 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-nepse-accent/20 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-nepse-accent text-2xl shadow-sm mb-6 group-hover:bg-nepse-accent group-hover:text-white transition-all">
                <i className="fa-solid fa-briefcase"></i>
              </div>
              <h3 className="text-xl font-black text-nepse-primary mb-3">Multiple Portfolios</h3>
              <p className="text-gray-600 leading-relaxed">Organize your investments across different portfolios and track them all in one place.</p>
            </div>
            <div className="p-8 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-nepse-accent/20 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-nepse-accent text-2xl shadow-sm mb-6 group-hover:bg-nepse-accent group-hover:text-white transition-all">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <h3 className="text-xl font-black text-nepse-primary mb-3">Beautiful Widgets</h3>
              <p className="text-gray-600 leading-relaxed">Use beautiful in-app widgets to monitor your portfolio at a glance.</p>
            </div>
            <div className="p-8 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-nepse-accent/20 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-nepse-accent text-2xl shadow-sm mb-6 group-hover:bg-nepse-accent group-hover:text-white transition-all">
                <i className="fa-solid fa-mobile-screen-button"></i>
              </div>
              <h3 className="text-xl font-black text-nepse-primary mb-3">Mobile & Web</h3>
              <p className="text-gray-600 leading-relaxed">Access your portfolios seamlessly on mobile and web. Synchronized in real-time.</p>
            </div>
            <div className="p-8 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-nepse-accent/20 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-nepse-accent text-2xl shadow-sm mb-6 group-hover:bg-nepse-accent group-hover:text-white transition-all">
                <i className="fa-solid fa-bell"></i>
              </div>
              <h3 className="text-xl font-black text-nepse-primary mb-3">Stay Informed</h3>
              <p className="text-gray-600 leading-relaxed">Get notifications on your portfolio performance without the noise of market data.</p>
            </div>
            <div className="p-8 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-nepse-accent/20 transition-all group">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-nepse-accent text-2xl shadow-sm mb-6 group-hover:bg-nepse-accent group-hover:text-white transition-all">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <h3 className="text-xl font-black text-nepse-primary mb-3">Lightning Fast</h3>
              <p className="text-gray-600 leading-relaxed">Minimal design means lightning-fast load times. Your data, instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Insights Section */}
      {articles.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-black text-nepse-primary tracking-tight">Market Insights</h2>
              <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-sm">Latest news, analysis, and tutorials</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  to="/blogs/$slug"
                  params={{ slug: article.slug }}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col"
                >
                  <div className="h-48 overflow-hidden relative">
                    {article.featured_image ? (
                      <img
                        src={article.featured_image}
                        alt={article.title}
                        className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                        <i className="fa-solid fa-newspaper text-3xl text-blue-200"></i>
                      </div>
                    )}
                    <span className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold rounded-full text-blue-800 uppercase tracking-wider">
                      {article.category}
                    </span>
                  </div>
                  <div className="p-6 flex-grow flex flex-col">
                    <div className="text-gray-400 text-xs mb-2">
                      {new Date(article.published_at).toLocaleDateString()}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{article.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-grow">{article.excerpt}</p>
                    <div className="text-blue-600 font-semibold text-sm flex items-center mt-auto">
                      Read More <i className="fa-solid fa-arrow-right ml-2 text-xs"></i>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                to="/blogs"
                className="inline-flex items-center px-6 py-3 border border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
              >
                View All Articles
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* App Showcase */}
      <section id="app-showcase" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black text-nepse-primary tracking-tight">Experience the App</h2>
            <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-sm">Clean, intuitive interface designed for simplicity</p>
          </div>

          <div className="flex overflow-x-auto gap-8 pb-12 snap-x no-scrollbar">
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
              <div key={i} className="shrink-0 w-[240px] snap-center">
                <div className="bg-gray-50 rounded-3xl p-4 border border-gray-100 shadow-sm transition-transform hover:scale-[1.05]">
                  <img
                    src={`/screens/${item.img}`}
                    alt={item.label}
                    className="w-full h-auto rounded-2xl"
                    loading="lazy"
                  />
                </div>
                <div className="mt-4 text-center text-xs font-black text-gray-400 uppercase tracking-widest">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
