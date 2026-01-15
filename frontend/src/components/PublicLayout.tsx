import { useEffect, useState } from 'react'
import { Link, Outlet } from '@tanstack/react-router'

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
    <div className="min-h-screen bg-white font-['Outfit',_sans-serif] text-nepse-text-dark">
      {/* Top App Banner */}
      <div className="bg-nepse-primary text-white border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-white/90">
            <span className="hidden sm:inline">Experience the best of Nepse Portfolio Tracker on mobile.</span>
            <span className="sm:hidden">Get the mobile app</span>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=com.ashok.nepseportfoliotracker"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-all group"
          >
            <i className="fa-brands fa-google-play group-hover:scale-110 transition-transform"></i>
            <span>Download App</span>
          </a>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center py-2 md:h-16 gap-2 md:gap-4">

            {/* Top Bar: Logo & Ticker */}
            <div className="flex items-center justify-between w-full md:w-auto shrink-0 px-1">
              <Link to="/" className="flex items-center gap-1.5" onClick={() => setShowResults(false)}>
                <div className="w-9 h-9 bg-gradient-to-br from-nepse-primary to-nepse-accent rounded-lg flex items-center justify-center text-white" style={{ maskImage: 'url("/icon.png")', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskImage: 'url("/icon.png")' }}>
                </div>
              </Link>

              {/* Ticker for Mobile */}
              <div className="flex md:hidden items-center gap-1.5 px-2 py-1 bg-nepse-primary text-white rounded-md text-[10px] font-bold shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${status.class === 'open' ? 'bg-green-400 animate-pulse' : status.class === 'pre-open' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`}></span>
                <span>{idx ? formatNumber(idx.nepse_index) : '--'}</span>
                <span className={(idx?.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {idx ? `${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.percentage_change).toFixed(2)}%` : '--'}
                </span>
              </div>
            </div>

            {/* Middle: Links (Desktop) */}
            <div className="hidden md:flex items-center gap-1 ml-4">
              <Link to="/stocks" className="px-3 py-2 text-sm font-semibold text-nepse-text-dark hover:text-nepse-primary hover:bg-nepse-light-bg rounded-lg transition-colors">Stocks</Link>
              <Link to="/blogs" className="px-3 py-2 text-sm font-semibold text-nepse-text-dark hover:text-nepse-primary hover:bg-nepse-light-bg rounded-lg transition-colors">Insights</Link>
            </div>

            {/* Search Container */}
            <div className="flex-1 relative w-full max-w-2xl mx-auto px-1 md:px-0">
              <div className="relative group">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-nepse-text-light group-focus-within:text-nepse-primary transition-colors text-sm"></i>
                <input
                  type="text"
                  placeholder="Search stocks (NTC, UPPER...)"
                  className="w-full pl-10 pr-4 py-1.5 md:py-2 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:bg-white focus:border-nepse-primary focus:ring-2 focus:ring-nepse-primary/10 transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowResults(true)
                  }}
                  onFocus={() => setShowResults(true)}
                />
              </div>

              {showResults && (searchQuery.length >= 2) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-[60] max-h-[400px] overflow-y-auto">
                  {searchResults.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {searchResults.map((item) => (
                        <Link
                          key={item.symbol}
                          to="/script/$symbol"
                          params={{ symbol: item.symbol }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                          onClick={() => {
                            setShowResults(false)
                            setSearchQuery('')
                          }}
                        >
                          <div className="min-w-[60px] h-7 flex items-center justify-center font-bold text-xs bg-nepse-primary/10 text-nepse-primary rounded-md group-hover:bg-nepse-primary group-hover:text-white transition-colors">
                            {item.symbol}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-nepse-text-dark">{item.name || item.company_name}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm text-nepse-text-light italic">No stocks found</div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Ticker (Desktop) */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-nepse-primary rounded-lg text-white text-sm font-bold shadow-sm">
                <span className={`w-2 h-2 rounded-full ${status.class === 'open' ? 'bg-green-400 animate-pulse' : status.class === 'pre-open' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`}></span>
                <span>{idx ? formatNumber(idx.nepse_index) : '--'}</span>
                <span className={(idx?.change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {idx ? `${idx.change >= 0 ? '↑' : '↓'} ${Math.abs(idx.percentage_change).toFixed(2)}%` : '--'}
                </span>
              </div>
            </div>

          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="min-h-[calc(100vh-200px)]">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-nepse-primary text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <h4 className="text-xl font-bold">Nepse Portfolio Tracker</h4>
              <p className="text-nepse-light-bg/80 text-sm max-w-sm">
                Empowering Nepali investors with real-time tracking, insights, and analysis tools for a smarter stock market experience.
              </p>
            </div>

            <div className="flex flex-col md:items-end gap-4">
              <h4 className="text-lg font-bold">Platform</h4>
              <div className="flex flex-wrap gap-4 text-sm text-nepse-light-bg/70">
                <Link to="/stocks" className="hover:text-white transition-colors">Stocks</Link>
                <Link to="/blogs" className="hover:text-white transition-colors">Insights</Link>
                <Link to="/feedback" className="hover:text-white transition-colors">Feedback</Link>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-nepse-light-bg/60 text-sm italic">
              © {new Date().getFullYear()} Nepse Portfolio Tracker. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <Link to="/privacy-policy" className="text-nepse-light-bg/60 hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms-of-service" className="text-nepse-light-bg/60 hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
