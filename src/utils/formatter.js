const formatResponse = (data, message = 'Success') => {
  return {
    success: true,
    status: 'success',
    message: message,
    data: data
  };
};

const formatError = (message = 'Error', statusCode = 500) => {
  return {
    success: false,
    status: 'error',
    message: message,
    code: statusCode
  };
};

const formatPricesForDatabase = (prices) => {
  const pricesArray = Array.isArray(prices) ? prices : [prices];

  return pricesArray.map(price => ({
    symbol: price.symbol,
    security_name: price.securityName,
    security_id: price.securityId || price.security_id,
    business_date: price.businessDate,
    open_price: price.openPrice || 0,
    high_price: price.highPrice || 0,
    low_price: price.lowPrice || 0,
    close_price: price.closePrice || 0,
    previous_close: price.previousClose || 0,
    change: price.change || 0,
    percentage_change: price.percentageChange || 0,
    total_traded_quantity: price.totalTradedQuantity || 0,
    total_traded_value: price.totalTradedValue || 0,
    total_trades: price.totalTrades || 0,
    average_traded_price: price.averageTradedPrice || 0,
    market_capitalization: price.marketCapitalization || 0,
    fifty_two_week_high: price.fiftyTwoWeekHigh || 0,
    fifty_two_week_low: price.fiftyTwoWeekLow || 0,
    last_updated_time: price.lastUpdatedTime,
    last_traded_price: price.lastTradedPrice || 0,
    volume: price.volume || 0,
    turnover: price.turnover || 0,
    max_price: price.maxPrice || 0,
    min_price: price.minPrice || 0
  }));
};

const formatCompanyDetailsForDatabase = (details) => {
  const detailsArray = Array.isArray(details) ? details : [details];

  return detailsArray.map(detail => ({
    security_id: detail.securityId || detail.security_id,
    symbol: detail.symbol,
    company_name: detail.companyName,
    nepali_company_name: detail.nepali_company_name,
    sector_name: detail.sectorName,
    nepali_sector_name: detail.nepali_sector_name,
    instrument_type: detail.instrumentType,
    issue_manager: detail.issueManager,
    share_registrar: detail.shareRegistrar,
    listing_date: detail.listingDate,
    total_listed_shares: detail.totalListedShares,
    paid_up_capital: detail.paidUpCapital,
    total_paid_up_value: detail.totalPaidUpValue,
    email: detail.email,
    website: detail.website,
    status: detail.status,
    permitted_to_trade: detail.permittedToTrade,
    promoter_shares: detail.promoterShares,
    public_shares: detail.publicShares,
    market_capitalization: detail.market_capitalization || detail.marketCapitalization || 0,
    pe_ratio: detail.pe_ratio || 0,
    pb_ratio: detail.pb_ratio || 0,
    dividend_yield: detail.dividend_yield || 0,
    eps: detail.eps || 0,
    maturity_date: detail.maturity_date || detail.maturityDate || null,
    maturity_period: detail.maturity_period || detail.maturityPeriod || null,
    logo_url: detail.logoUrl,
    is_logo_placeholder: detail.isLogoPlaceholder,
    last_traded_price: detail.lastTradedPrice || 0,
    open_price: detail.openPrice || 0,
    close_price: detail.closePrice || 0,
    high_price: detail.highPrice || 0,
    low_price: detail.lowPrice || 0,
    previous_close: detail.previousClose || 0,
    fifty_two_week_high: detail.fiftyTwoWeekHigh || 0,
    fifty_two_week_low: detail.fiftyTwoWeekLow || 0,
    total_traded_quantity: detail.totalTradedQuantity || 0,
    total_trades: detail.totalTrades || 0,
    average_traded_price: detail.averageTradedPrice || 0
  }));
};

const formatDividendsForDatabase = (dividends) => {
  const dividendsArray = Array.isArray(dividends) ? dividends : [dividends];
  return dividendsArray.map(d => ({
    security_id: d.securityId || d.security_id,
    fiscal_year: d.fiscalYear || d.fiscal_year,
    bonus_share: d.bonusShare || d.bonus_share || 0,
    cash_dividend: d.cashDividend || d.cash_dividend || 0,
    total_dividend: d.totalDividend || d.total_dividend || 0,
    published_date: d.publishedDate || d.published_date || ''
  }));
};

const formatFinancialsForDatabase = (financials) => {
  const financialsArray = Array.isArray(financials) ? financials : [financials];
  return financialsArray.map(f => ({
    security_id: f.securityId || f.security_id,
    fiscal_year: f.fiscalYear || f.fiscal_year,
    quarter: f.quarter,
    paid_up_capital: f.paidUpCapital || f.paid_up_capital || 0,
    net_profit: f.netProfit || f.net_profit || 0,
    earnings_per_share: f.earningsPerShare || f.earnings_per_share || 0,
    net_worth_per_share: f.netWorthPerShare || f.net_worth_per_share || 0,
    price_earnings_ratio: f.priceEarningsRatio || f.price_earnings_ratio || 0
  }));
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')  // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
};

module.exports = {
  formatResponse,
  formatError,
  formatPricesForDatabase,
  formatCompanyDetailsForDatabase,
  formatDividendsForDatabase,
  formatFinancialsForDatabase,
  slugify
};