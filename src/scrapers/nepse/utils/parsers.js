// Common parsing utilities for NEPSE scraper

/**
 * Safely parse a number from various formats
 */
function parseNumber(val) {
  if (val === null || val === undefined || val === '' || val === '-' || val === 'N/A') {
    return 0;
  }
  if (typeof val === 'number') {
    return val;
  }
  return parseFloat(String(val).replace(/,/g, '')) || 0;
}

/**
 * Clean text by removing extra whitespace
 */
function cleanText(text) {
  return text ? String(text).replace(/\s+/g, ' ').trim() : '';
}

/**
 * Format CSV download data to standard format
 */
function formatCSVDownloadData(data) {
  if (!Array.isArray(data)) return [];

  return data.map(record => {
    // Calculate changes
    const ltp = record.lastUpdatedPrice || record.lastTradedPrice || record.closePrice || 0;
    const prevClose = record.previousDayClosePrice || 0;
    const pointChange = ltp && prevClose ? (ltp - prevClose) : 0;
    const percentChange = prevClose && prevClose !== 0 ? ((pointChange / prevClose) * 100) : 0;

    return {
      symbol: record.symbol,
      securityName: record.securityName,
      securityId: record.securityId,
      businessDate: record.businessDate,
      openPrice: record.openPrice || 0,
      highPrice: record.highPrice || 0,
      lowPrice: record.lowPrice || 0,
      closePrice: ltp,
      previousClose: prevClose,
      change: pointChange,
      percentageChange: percentChange,
      totalTradedQuantity: record.totalTradedQuantity || 0,
      totalTradedValue: record.totalTradedValue || 0,
      totalTrades: record.totalTrades || 0,
      averageTradedPrice: record.averageTradedPrice || 0,
      marketCapitalization: record.marketCapitalization || 0,
      fiftyTwoWeekHigh: record.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: record.fiftyTwoWeekLow || 0,
      lastUpdatedTime: record.lastUpdatedTime,
      lastTradedPrice: ltp,
      volume: record.totalTradedQuantity || 0,
      turnover: record.totalTradedValue || 0,
      maxPrice: record.highPrice || 0,
      minPrice: record.lowPrice || 0
    };
  }).filter(stock => stock.symbol);
}

/**
 * Format API data to standard format
 */
function formatAPIData(stockArray) {
  return stockArray.map(stock => {
    const ltp = stock.lastUpdatedPrice || stock.lastTradedPrice || stock.closePrice || 0;
    const prevClose = stock.previousDayClosePrice || 0;
    const pointChange = ltp && prevClose ? (ltp - prevClose) : 0;
    const percentChange = prevClose && prevClose !== 0 ? ((pointChange / prevClose) * 100) : 0;

    return {
      symbol: stock.symbol,
      securityName: stock.securityName,
      securityId: stock.securityId,
      businessDate: stock.businessDate,
      openPrice: stock.openPrice,
      highPrice: stock.highPrice,
      lowPrice: stock.lowPrice,
      closePrice: ltp,
      previousClose: prevClose,
      change: pointChange,
      percentageChange: percentChange,
      totalTradedQuantity: stock.totalTradedQuantity,
      totalTradedValue: stock.totalTradedValue,
      totalTrades: stock.totalTrades,
      averageTradedPrice: stock.averageTradedPrice,
      marketCapitalization: stock.marketCapitalization,
      fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stock.fiftyTwoWeekLow,
      lastUpdatedTime: stock.lastUpdatedTime,
      lastTradedPrice: ltp,
      volume: stock.totalTradedQuantity,
      turnover: stock.totalTradedValue,
      maxPrice: stock.highPrice,
      minPrice: stock.lowPrice
    };
  });
}

/**
 * Format HTML scraped data to standard format
 */
function formatHTMLData(rawData) {
  const { DateTime } = require('luxon');

  return rawData.map(row => {
    const symbol = row.symbol || row.scriptsymbol || row.script || '';
    const closePrice = parseNumber(row.ltp || row.closingprice || row.close);
    const previousClose = parseNumber(row.previousclose || row.prevclose);

    return {
      symbol: symbol.toUpperCase(),
      securityName: row.companyname || row.securityname || row.name || '',
      businessDate: DateTime.now().setZone('Asia/Kathmandu').toISODate(),
      openPrice: parseNumber(row.open || row.openprice),
      highPrice: parseNumber(row.high || row.highprice || row.max),
      lowPrice: parseNumber(row.low || row.lowprice || row.min),
      closePrice: closePrice,
      previousClose: previousClose,
      change: closePrice - previousClose,
      percentageChange: previousClose > 0 ? ((closePrice - previousClose) / previousClose * 100) : 0,
      totalTradedQuantity: parseNumber(row.qty || row.quantity || row.volume),
      totalTradedValue: parseNumber(row.turnover || row.amount || row.value),
      lastTradedPrice: closePrice,
      volume: parseNumber(row.qty || row.quantity || row.volume),
      turnover: parseNumber(row.turnover || row.amount || row.value),
      maxPrice: parseNumber(row.high || row.highprice || row.max),
      minPrice: parseNumber(row.low || row.lowprice || row.min)
    };
  }).filter(stock => stock.symbol && stock.symbol.length > 0);
}

module.exports = {
  parseNumber,
  cleanText,
  formatCSVDownloadData,
  formatAPIData,
  formatHTMLData
};
