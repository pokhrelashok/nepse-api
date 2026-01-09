
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
        p.business_date || null,
        p.security_id || null,
        p.symbol || null,
        p.security_name || null,
        p.open_price ?? 0,
        p.high_price ?? 0,
        p.low_price ?? 0,
        p.close_price ?? 0,
        p.total_traded_quantity ?? 0,
        p.total_traded_value ?? 0,
        p.previous_close ?? 0,
        p.change ?? 0,
        p.percentage_change ?? 0,
        p.last_traded_price ?? 0,
        p.fifty_two_week_high ?? 0,
        p.fifty_two_week_low ?? 0
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

    // First, get financial data and dividend info for each symbol to compute metrics
    const symbols = detailsArray.map(d => d.symbol).filter(Boolean);
    const financialData = new Map();
    const dividendData = new Map();

    if (symbols.length > 0) {
      // Get latest financial data
      const [financials] = await connection.query(`
        SELECT 
          cd.symbol,
          cf.earnings_per_share,
          cf.net_worth_per_share
        FROM company_details cd
        LEFT JOIN (
          SELECT security_id, earnings_per_share, net_worth_per_share
          FROM company_financials
          WHERE (security_id, fiscal_year) IN (
            SELECT security_id, MAX(fiscal_year)
            FROM company_financials
            GROUP BY security_id
          )
        ) cf ON cd.security_id = cf.security_id
        WHERE cd.symbol IN (?)
      `, [symbols]);

      financials.forEach(row => {
        financialData.set(row.symbol, {
          eps: row.earnings_per_share,
          bookValue: row.net_worth_per_share
        });
      });

      // Get latest dividend data
      const [dividends] = await connection.query(`
        SELECT 
          symbol, 
          CAST(COALESCE(bonus_share, '0') AS DECIMAL(10,2)) + 
          CAST(COALESCE(cash_dividend, '0') AS DECIMAL(10,2)) as total_dividend
        FROM announced_dividends
        WHERE symbol IN (?)
          AND fiscal_year = (SELECT MAX(fiscal_year) FROM announced_dividends WHERE symbol = announced_dividends.symbol)
        GROUP BY symbol, bonus_share, cash_dividend
      `, [symbols]);

      dividends.forEach(row => {
        dividendData.set(row.symbol, row.total_dividend);
      });
    }

    const sql = `
      INSERT INTO company_details (
        security_id, symbol, company_name, nepali_company_name, sector_name, nepali_sector_name,
        instrument_type, issue_manager, share_registrar,
        listing_date, total_listed_shares, paid_up_capital,
        total_paid_up_value, email, website, status, permitted_to_trade,
        promoter_shares, public_shares, market_capitalization,
        pe_ratio, pb_ratio, dividend_yield,
        logo_url, is_logo_placeholder, last_traded_price,
        open_price, close_price, high_price, low_price, previous_close,
        fifty_two_week_high, fifty_two_week_low, total_traded_quantity,
        total_trades, average_traded_price, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        symbol = VALUES(symbol),
        company_name = VALUES(company_name),
        nepali_company_name = COALESCE(VALUES(nepali_company_name), nepali_company_name),
        sector_name = VALUES(sector_name),
        nepali_sector_name = COALESCE(VALUES(nepali_sector_name), nepali_sector_name),
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
        pe_ratio = VALUES(pe_ratio),
        pb_ratio = VALUES(pb_ratio),
        dividend_yield = VALUES(dividend_yield),
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
      // Compute financial metrics
      const price = d.close_price || d.last_traded_price || 0;
      const financial = financialData.get(d.symbol);
      const totalDividend = dividendData.get(d.symbol) || 0;

      let peRatio = null;
      let pbRatio = null;
      let dividendYield = null;

      if (financial && price > 0) {
        // P/E Ratio = Price / EPS
        if (financial.eps && financial.eps > 0) {
          peRatio = price / financial.eps;
        }

        // P/B Ratio = Price / Book Value
        if (financial.bookValue && financial.bookValue > 0) {
          pbRatio = price / financial.bookValue;
        }
      }

      // Dividend Yield = (Annual Dividend / Price) * 100
      if (totalDividend > 0 && price > 0) {
        dividendYield = (totalDividend / price) * 100;
      }

      await connection.execute(sql, [
        d.security_id || null,
        d.symbol || null,
        d.company_name || null,
        d.nepali_company_name || null,
        d.sector_name || null,
        d.nepali_sector_name || null,
        d.instrument_type || null,
        d.issue_manager || null,
        d.share_registrar || null,
        d.listing_date || null,
        d.total_listed_shares ?? 0,
        d.paid_up_capital ?? 0,
        d.total_paid_up_value ?? 0,
        d.email || null,
        d.website || null,
        d.status || null,
        d.permitted_to_trade || null,
        d.promoter_shares ?? 0,
        d.public_shares ?? 0,
        d.market_capitalization ?? 0,
        peRatio,
        pbRatio,
        dividendYield,
        d.logo_url || null,
        d.is_logo_placeholder ? 1 : 0,
        d.last_traded_price ?? 0,
        d.open_price ?? 0,
        // Fallback: Use last_traded_price if close_price is 0
        (d.close_price && d.close_price > 0) ? d.close_price : (d.last_traded_price ?? 0),
        d.high_price ?? 0,
        d.low_price ?? 0,
        d.previous_close ?? 0,
        d.fifty_two_week_high ?? 0,
        d.fifty_two_week_low ?? 0,
        d.total_traded_quantity ?? 0,
        d.total_trades ?? 0,
        d.average_traded_price ?? 0
      ]);
    }

    await connection.commit();
    logger.info(`Saved/Updated ${detailsArray.length} company details with computed metrics.`);
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

    // Only update updated_at if values ACTUALLY change
    const sql = `
      INSERT INTO dividends (
        security_id, fiscal_year, bonus_share, cash_dividend,
        total_dividend, published_date
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        updated_at = CASE 
          WHEN bonus_share != VALUES(bonus_share) OR 
               cash_dividend != VALUES(cash_dividend) OR 
               total_dividend != VALUES(total_dividend) OR 
               (published_date IS NULL AND VALUES(published_date) IS NOT NULL) OR
               (published_date != VALUES(published_date))
          THEN NOW() 
          ELSE updated_at 
        END,
        bonus_share = VALUES(bonus_share),
        cash_dividend = VALUES(cash_dividend),
        total_dividend = VALUES(total_dividend),
        published_date = VALUES(published_date)
    `;

    for (const d of dividends) {
      await connection.execute(sql, [
        d.securityId || null,
        d.fiscalYear || null,
        d.bonusShare ?? 0,
        d.cashDividend ?? 0,
        d.totalDividend ?? 0,
        d.publishedDate || null
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
        f.securityId || null,
        f.fiscalYear || null,
        f.quarter || null,
        f.paidUpCapital ?? 0,
        f.netProfit ?? 0,
        f.earningsPerShare ?? 0,
        f.netWorthPerShare ?? 0,
        f.priceEarningsRatio ?? 0
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

async function saveStockPriceHistory(historyData) {
  if (!historyData || historyData.length === 0) return Promise.resolve(0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sql = `
      INSERT INTO stock_price_history (
        security_id, symbol, business_date, high_price, 
        low_price, close_price, total_trades, total_traded_quantity, 
        total_traded_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        symbol = VALUES(symbol),
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        close_price = VALUES(close_price),
        total_trades = VALUES(total_trades),
        total_traded_quantity = VALUES(total_traded_quantity),
        total_traded_value = VALUES(total_traded_value),
        updated_at = CURRENT_TIMESTAMP
    `;

    let insertedCount = 0;
    for (const record of historyData) {
      await connection.execute(sql, [
        record.security_id || null,
        record.symbol || null,
        record.business_date || null,
        record.high_price ?? null,
        record.low_price ?? null,
        record.close_price ?? null,
        record.total_trades ?? null,
        record.total_traded_quantity ?? null,
        record.total_traded_value ?? null
      ]);
      insertedCount++;
    }

    await connection.commit();
    logger.info(`Saved ${insertedCount} historical price records.`);
    return insertedCount;
  } catch (err) {
    await connection.rollback();
    logger.error('Error saving stock price history:', err);
    throw err;
  } finally {
    connection.release();
  }
}

async function saveMarketIndexHistory(historyData) {
  if (!historyData || historyData.length === 0) return Promise.resolve(0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sql = `
      INSERT INTO market_indices_history (
        business_date, exchange_index_id, index_name, closing_index, 
        open_index, high_index, low_index, fifty_two_week_high, 
        fifty_two_week_low, turnover_value, turnover_volume, 
        total_transaction, abs_change, percentage_change
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        index_name = VALUES(index_name),
        closing_index = VALUES(closing_index),
        open_index = VALUES(open_index),
        high_index = VALUES(high_index),
        low_index = VALUES(low_index),
        fifty_two_week_high = VALUES(fifty_two_week_high),
        fifty_two_week_low = VALUES(fifty_two_week_low),
        turnover_value = VALUES(turnover_value),
        turnover_volume = VALUES(turnover_volume),
        total_transaction = VALUES(total_transaction),
        abs_change = VALUES(abs_change),
        percentage_change = VALUES(percentage_change),
        updated_at = CURRENT_TIMESTAMP
    `;

    let insertedCount = 0;
    for (const record of historyData) {
      await connection.execute(sql, [
        record.business_date || null,
        record.exchange_index_id || null,
        record.index_name || null,
        record.closing_index ?? 0,
        record.open_index ?? 0,
        record.high_index ?? 0,
        record.low_index ?? 0,
        record.fifty_two_week_high ?? 0,
        record.fifty_two_week_low ?? 0,
        record.turnover_value ?? 0,
        record.turnover_volume ?? 0,
        record.total_transaction ?? 0,
        record.abs_change ?? 0,
        record.percentage_change ?? 0
      ]);
      insertedCount++;
    }

    await connection.commit();
    logger.info(`Saved ${insertedCount} market index historical records.`);
    return insertedCount;
  } catch (err) {
    await connection.rollback();
    logger.error('Error saving market index history:', err);
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
  saveFinancials,
  saveStockPriceHistory,
  saveMarketIndexHistory
};