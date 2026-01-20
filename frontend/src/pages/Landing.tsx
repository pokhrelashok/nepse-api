import { Link } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
import { DashboardCard } from '../components/DashboardCard'
import { BlogCard } from '../components/BlogCard'

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
  name?: string
  company_name?: string
  security_name?: string
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

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

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
                      to="/script/$slug"
                      params={{ slug: `${stock.symbol}-${slugify(stock.name || stock.company_name || (stock as any).security_name || '')}` }}
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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 space-y-8 text-center md:text-left z-10">
            <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight drop-shadow-sm">
              Track Like a <span className="text-nepse-accent">PRO</span>
            </h1>
            <p className="text-xl md:text-2xl text-blue-50 font-medium max-w-xl mx-auto md:mx-0 leading-relaxed">
              Join thousands of investors using our platform to monitor their NEPSE portfolios with precision and ease.
            </p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
            <a
              href="https://play.google.com/store/apps/details?id=com.ashok.nepseportfoliotracker"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-white text-[#1a472a] px-8 py-5 rounded-2xl font-bold text-lg hover:bg-nepse-accent hover:text-white transition-all transform hover:-translate-y-1 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_40px_-10px_rgba(82,183,136,0.5)]"
            >
              <div className="shrink-0 bg-[#1a472a]/10 group-hover:bg-white/20 p-2.5 rounded-xl transition-colors">
                <i className="fa-brands fa-google-play text-2xl text-[#1a472a] group-hover:text-white"></i>
              </div>
              <div className="text-left leading-none">
                <div className="text-[11px] uppercase tracking-wider font-extrabold opacity-70 mb-1">Get it on</div>
                <div className="text-xl font-black tracking-tight">Play Store</div>
              </div>
            </a>
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
      {
        articles.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
                <h2 className="text-3xl md:text-5xl font-black text-nepse-primary tracking-tight">Market Insights</h2>
                <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-sm">Latest news, analysis, and tutorials</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {articles.map((article) => (
                  <BlogCard key={article.id} blog={article} />
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
        )
      }

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
    </div >
  )
}
