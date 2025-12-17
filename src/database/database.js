require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'nepse',
  password: process.env.DB_PASSWORD || 'nepse_password',
  database: process.env.DB_NAME || 'nepse_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Timezone for Nepal (UTC+5:45)
  timezone: '+05:45'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Initialize database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('Connected to MySQL database.');
    connection.release();
  } catch (err) {
    logger.error('Error connecting to MySQL database:', err);
  }
}

// Check connection on module load
testConnection();

async function savePrices(prices) {
  if (!prices || prices.length === 0) return Promise.resolve();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sql = `
      INSERT INTO stock_prices (
        business_date, security_id, symbol, security_name,
        open_price, high_price, low_price, close_price,
        total_traded_quantity, total_traded_value, previous_close,
        \`change\`, percentage_change, last_traded_price,
        fifty_two_week_high, fifty_two_week_low, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        business_date = VALUES(business_date),
        security_id = VALUES(security_id),
        security_name = VALUES(security_name),
        open_price = VALUES(open_price),
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        close_price = VALUES(close_price),
        total_traded_quantity = VALUES(total_traded_quantity),
        total_traded_value = VALUES(total_traded_value),
        previous_close = VALUES(previous_close),
        \`change\` = VALUES(\`change\`),
        percentage_change = VALUES(percentage_change),
        last_traded_price = VALUES(last_traded_price),
        fifty_two_week_high = VALUES(fifty_two_week_high),
        fifty_two_week_low = VALUES(fifty_two_week_low),
        created_at = NOW()
    `;

    for (const p of prices) {
      await connection.execute(sql, [
        p.businessDate, p.securityId, p.symbol, p.securityName,
        p.openPrice, p.highPrice, p.lowPrice, p.closePrice,
        p.totalTradedQuantity, p.totalTradedValue, p.previousClose,
        p.change, p.percentageChange, p.lastTradedPrice,
        p.fiftyTwoWeekHigh, p.fiftyTwoWeekLow
      ]);
    }

    await connection.commit();
    logger.info(`Saved ${prices.length} price records.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function saveCompanyDetails(detailsArray) {
  if (!detailsArray || detailsArray.length === 0) return Promise.resolve();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sql = `
      INSERT INTO company_details (
        security_id, symbol, company_name, sector_name,
        instrument_type, issue_manager, share_registrar,
        listing_date, total_listed_shares, paid_up_capital,
        total_paid_up_value, email, website, status, permitted_to_trade,
        promoter_shares, public_shares, market_capitalization,
        logo_url, is_logo_placeholder, last_traded_price,
        open_price, close_price, high_price, low_price, previous_close,
        fifty_two_week_high, fifty_two_week_low, total_traded_quantity,
        total_trades, average_traded_price, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        symbol = VALUES(symbol),
        company_name = VALUES(company_name),
        sector_name = VALUES(sector_name),
        instrument_type = VALUES(instrument_type),
        issue_manager = VALUES(issue_manager),
        share_registrar = VALUES(share_registrar),
        listing_date = VALUES(listing_date),
        total_listed_shares = VALUES(total_listed_shares),
        paid_up_capital = VALUES(paid_up_capital),
        total_paid_up_value = VALUES(total_paid_up_value),
        email = VALUES(email),
        website = VALUES(website),
        status = VALUES(status),
        permitted_to_trade = VALUES(permitted_to_trade),
        promoter_shares = VALUES(promoter_shares),
        public_shares = VALUES(public_shares),
        market_capitalization = VALUES(market_capitalization),
        logo_url = VALUES(logo_url),
        is_logo_placeholder = VALUES(is_logo_placeholder),
        last_traded_price = VALUES(last_traded_price),
        open_price = VALUES(open_price),
        close_price = VALUES(close_price),
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        previous_close = VALUES(previous_close),
        fifty_two_week_high = VALUES(fifty_two_week_high),
        fifty_two_week_low = VALUES(fifty_two_week_low),
        total_traded_quantity = VALUES(total_traded_quantity),
        total_trades = VALUES(total_trades),
        average_traded_price = VALUES(average_traded_price),
        updated_at = NOW()
    `;

    for (const d of detailsArray) {
      await connection.execute(sql, [
        d.securityId, d.symbol, d.companyName, d.sectorName,
        d.instrumentType, d.issueManager, d.shareRegistrar,
        d.listingDate, d.totalListedShares, d.paidUpCapital,
        d.totalPaidUpValue || null, d.email, d.website, d.status || null, d.permittedToTrade || null,
        d.promoterShares || null, d.publicShares || null, d.marketCapitalization || null,
        d.logoUrl || null, d.isLogoPlaceholder ? 1 : 0, d.lastTradedPrice || null,
        d.openPrice || null, d.closePrice || null, d.highPrice || null, d.lowPrice || null, d.previousClose || null,
        d.fiftyTwoWeekHigh || null, d.fiftyTwoWeekLow || null, d.totalTradedQuantity || null,
        d.totalTrades || null, d.averageTradedPrice || null
      ]);
    }

    await connection.commit();
    logger.info(`Saved/Updated ${detailsArray.length} company details.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function saveDividends(dividends) {
  if (!dividends || dividends.length === 0) return Promise.resolve();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sql = `
      INSERT INTO dividends (
        security_id, fiscal_year, bonus_share, cash_dividend,
        total_dividend, book_close_date
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        bonus_share = VALUES(bonus_share),
        cash_dividend = VALUES(cash_dividend),
        total_dividend = VALUES(total_dividend),
        book_close_date = VALUES(book_close_date),
        updated_at = NOW()
    `;

    for (const d of dividends) {
      await connection.execute(sql, [
        d.securityId, d.fiscalYear, d.bonusShare, d.cashDividend,
        d.totalDividend, d.bookCloseDate
      ]);
    }

    await connection.commit();
    logger.info(`Saved ${dividends.length} dividend records.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function saveFinancials(financials) {
  if (!financials || financials.length === 0) return Promise.resolve();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sql = `
      INSERT INTO company_financials (
        security_id, fiscal_year, quarter, paid_up_capital,
        net_profit, earnings_per_share, net_worth_per_share,
        price_earnings_ratio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        paid_up_capital = VALUES(paid_up_capital),
        net_profit = VALUES(net_profit),
        earnings_per_share = VALUES(earnings_per_share),
        net_worth_per_share = VALUES(net_worth_per_share),
        price_earnings_ratio = VALUES(price_earnings_ratio),
        updated_at = NOW()
    `;

    for (const f of financials) {
      await connection.execute(sql, [
        f.securityId, f.fiscalYear, f.quarter, f.paidUpCapital,
        f.netProfit, f.earningsPerShare, f.netWorthPerShare,
        f.priceEarningsRatio
      ]);
    }

    await connection.commit();
    logger.info(`Saved ${financials.length} financial records.`);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Export pool for queries
module.exports = {
  pool,
  savePrices,
  saveCompanyDetails,
  saveDividends,
  saveFinancials
};