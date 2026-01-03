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
  // If prices is a single object, convert to array
  const pricesArray = Array.isArray(prices) ? prices : [prices];

  return pricesArray.map(price => ({
    symbol: price.symbol,
    security_name: price.securityName,
    security_id: price.securityId,
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
  // If details is a single object, convert to array
  const detailsArray = Array.isArray(details) ? details : [details];

  return detailsArray.map(detail => ({
    security_id: detail.securityId,
    symbol: detail.symbol,
    company_name: detail.companyName,
    sector_name: detail.sectorName,
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
    market_capitalization: detail.marketCapitalization,
    logo_url: detail.logoUrl,
    is_logo_placeholder: detail.isLogoPlaceholder,
    last_traded_price: detail.lastTradedPrice,
    open_price: detail.openPrice,
    close_price: detail.closePrice,
    high_price: detail.highPrice,
    low_price: detail.lowPrice,
    previous_close: detail.previousClose,
    fifty_two_week_high: detail.fiftyTwoWeekHigh,
    fifty_two_week_low: detail.fiftyTwoWeekLow,
    total_traded_quantity: detail.totalTradedQuantity,
    total_trades: detail.totalTrades,
    average_traded_price: detail.averageTradedPrice
  }));
};

module.exports = { formatResponse, formatError, formatPricesForDatabase, formatCompanyDetailsForDatabase };