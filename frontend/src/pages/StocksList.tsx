import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'
import '../styles/stocks-list.css'

interface Stock {
  symbol: string
  name: string
  sector: string
  company_name?: string
  sector_name?: string
  ltp: number
  close_price: number
  percentage_change: number
  market_capitalization: number
}

export default function StocksList() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState('All')
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change' | 'marketcap'>('symbol')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/scripts')
        const result = await response.json()
        setStocks(result.data || result)
      } catch (error) {
        console.error('Failed to fetch stocks:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStocks()
  }, [])

  const sectors = ['All', ...Array.from(new Set(stocks.map(s => s.sector || s.sector_name).filter(Boolean)))]

  const filteredStocks = stocks
    .filter(stock => {
      const stockName = stock.name || stock.company_name
      const stockSector = stock.sector || stock.sector_name
      const matchesSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stockName?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSector = selectedSector === 'All' || stockSector === selectedSector
      return matchesSearch && matchesSector
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol)
          break
        case 'price':
          comparison = (a.ltp || a.close_price || 0) - (b.ltp || b.close_price || 0)
          break
        case 'change':
          comparison = (a.percentage_change || 0) - (b.percentage_change || 0)
          break
        case 'marketcap':
          comparison = (a.market_capitalization || 0) - (b.market_capitalization || 0)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedSector, sortBy, sortOrder])

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedStocks = filteredStocks.slice(startIndex, startIndex + itemsPerPage)

  const formatNumber = (num: number | null | undefined) => {
    if (!num) return 'N/A'
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatMarketCap = (val: number | null | undefined) => {
    if (!val) return 'N/A'
    if (val >= 10000000) return `Rs. ${(val / 10000000).toFixed(2)} Cr`
    if (val >= 100000) return `Rs. ${(val / 100000).toFixed(2)} Lk`
    return `Rs. ${val.toLocaleString()}`
  }

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  return (
    <div className="stocks-list-container">
      <Helmet>
        <title>All NEPSE Stocks - Complete List of Nepal Stock Exchange Companies</title>
        <meta name="title" content="All NEPSE Stocks - Complete Nepal Stock Exchange List" />
        <meta name="description" content="Browse complete list of all stocks trading on Nepal Stock Exchange (NEPSE). Filter by sector, search companies, view live prices, market cap, and performance. Updated in real-time." />
        <meta name="keywords" content="NEPSE stocks list, Nepal stocks, all NEPSE companies, Nepal share market list, NEPSE sectors, stock screener Nepal, Nepal stock exchange companies" />
        <link rel="canonical" href="https://nepseportfoliotracker.app/stocks" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://nepseportfoliotracker.app/stocks" />
        <meta property="og:title" content="All NEPSE Stocks - Complete Nepal Stock Exchange List" />
        <meta property="og:description" content="Browse and filter all stocks on NEPSE with live prices and market data" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "NEPSE Stocks",
            "description": "Complete list of stocks trading on Nepal Stock Exchange",
            "numberOfItems": stocks.length,
            "itemListElement": filteredStocks.slice(0, 50).map((stock, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "Corporation",
                "name": stock.name,
                "tickerSymbol": stock.symbol,
                "url": `https://nepseportfoliotracker.app/script/${stock.symbol}`
              }
            }))
          })}
        </script>
      </Helmet>

      <div className="stocks-header">
        <h1>All NEPSE Stocks</h1>
        <p className="stocks-subtitle">
          Browse {stocks.length} companies trading on Nepal Stock Exchange
        </p>
      </div>

      <div className="stocks-filters">
        <div className="search-box">
          <i className="fa-solid fa-search"></i>
          <input
            type="text"
            placeholder="Search by symbol or company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="sector-filter">
          <label>Sector:</label>
          <select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading stocks...</div>
      ) : (
        <>
          <div className="stocks-count">
            Showing {filteredStocks.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, filteredStocks.length)} of {filteredStocks.length} stocks
            {filteredStocks.length !== stocks.length && <span className="total-badge">(Total: {stocks.length})</span>}
          </div>

          <div className="stocks-table-container">
            <table className="stocks-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('symbol')} className="sortable">
                    Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Company</th>
                  <th>Sector</th>
                  <th onClick={() => handleSort('price')} className="sortable">
                    LTP {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('change')} className="sortable">
                    Change {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('marketcap')} className="sortable">
                    Market Cap {sortBy === 'marketcap' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedStocks.map((stock) => {
                  const price = stock.ltp || stock.close_price || 0
                  const change = stock.percentage_change || 0
                  return (
                    <tr key={stock.symbol}>
                      <td>
                        <Link to="/script/$symbol" params={{ symbol: stock.symbol }} className="stock-symbol">
                          {stock.symbol}
                        </Link>
                      </td>
                      <td className="company-name">{stock.name || stock.company_name || '--'}</td>
                      <td className="sector-name">{stock.sector || stock.sector_name || '--'}</td>
                      <td className="stock-price">Rs. {formatNumber(price)}</td>
                      <td className={`stock-change ${change >= 0 ? 'positive' : 'negative'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </td>
                      <td className="market-cap">{formatMarketCap(stock.market_capitalization)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                <i className="fa-solid fa-chevron-left"></i> Previous
              </button>

              <div className="pagination-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show window around current page
                  let pageNum = i + 1
                  if (totalPages > 5) {
                    if (currentPage > 3) pageNum = currentPage - 2 + i
                    if (pageNum > totalPages) pageNum = totalPages - 4 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
