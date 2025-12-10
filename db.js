const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'nepse.db');

// Initialize Database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Error opening database:', err.message);
  } else {
    console.log('[DB] Connected to SQLite database.');
    initSchema();
  }
});

function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS stock_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_date TEXT NOT NULL,
        security_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        security_name TEXT,
        open_price REAL,
        high_price REAL,
        low_price REAL,
        close_price REAL,
        total_traded_quantity INTEGER,
        total_traded_value REAL,
        previous_close REAL,
        change REAL,
        percentage_change REAL,
        last_traded_price REAL,
        fifty_two_week_high REAL,
        fifty_two_week_low REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol ON stock_prices(symbol);

    CREATE TABLE IF NOT EXISTS company_details (
        security_id INTEGER PRIMARY KEY, 
        symbol TEXT NOT NULL,
        company_name TEXT,
        sector_name TEXT,
        instrument_type TEXT,
        issue_manager TEXT,
        share_registrar TEXT,
        listing_date TEXT,
        total_listed_shares REAL,
        paid_up_capital REAL,
        email TEXT,
        website TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_company_details_symbol ON company_details(symbol);
    `;

  db.exec(schema, (err) => {
    if (err) {
      console.error('[DB] Failed to create schema:', err.message);
    } else {
      console.log('[DB] Schema initialized successfully.');

      // Auto-Migration: Add new columns if missing
      const migrations = [
        "ALTER TABLE stock_prices ADD COLUMN total_trades INTEGER",
        "ALTER TABLE stock_prices ADD COLUMN average_traded_price REAL",
        "ALTER TABLE stock_prices ADD COLUMN market_capitalization REAL",

        "ALTER TABLE company_details ADD COLUMN promoter_shares REAL",
        "ALTER TABLE company_details ADD COLUMN public_shares REAL",
        "ALTER TABLE company_details ADD COLUMN status TEXT",
        "ALTER TABLE company_details ADD COLUMN permitted_to_trade TEXT"
      ];

      migrations.forEach(sql => {
        db.run(sql, (err) => {
          // Ignore error if column exists
        });
      });
    }
  });
}

function savePrices(prices) {
  if (!prices || prices.length === 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
            INSERT OR REPLACE INTO stock_prices (
                business_date, security_id, symbol, security_name,
                open_price, high_price, low_price, close_price,
                total_traded_quantity, total_traded_value, previous_close,
                change, percentage_change, last_traded_price,
                fifty_two_week_high, fifty_two_week_low, created_at,
                total_trades, average_traded_price, market_capitalization
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
        `);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      prices.forEach(p => {
        stmt.run(
          p.businessDate, p.securityId, p.symbol, p.securityName,
          p.openPrice, p.highPrice, p.lowPrice, p.closePrice,
          p.totalTradedQuantity, p.totalTradedValue, p.previousClose,
          p.change, p.percentageChange, p.lastTradedPrice,
          p.fiftyTwoWeekHigh, p.fiftyTwoWeekLow,
          p.totalTrades || null, p.averageTradedPrice || null, p.marketCapitalization || null
        );
      });

      db.run("COMMIT", (err) => {
        stmt.finalize();
        if (err) reject(err);
        else {
          console.log(`[DB] Saved ${prices.length} records.`);
          resolve();
        }
      });
    });
  });
}

function saveCompanyDetails(detailsArray) {
  if (!detailsArray || detailsArray.length === 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
            INSERT OR REPLACE INTO company_details (
                security_id, symbol, company_name, sector_name, 
                instrument_type, issue_manager, share_registrar, 
                listing_date, total_listed_shares, paid_up_capital, 
                email, website, updated_at,
                promoter_shares, public_shares, status, permitted_to_trade
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?)
        `);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      detailsArray.forEach(d => {
        stmt.run(
          d.securityId, d.symbol, d.companyName, d.sectorName,
          d.instrumentType, d.issueManager, d.shareRegistrar,
          d.listingDate, d.totalListedShares, d.paidUpCapital,
          d.email, d.website,
          d.promoterShares || null, d.publicShares || null, d.status || null, d.permittedToTrade || null
        );
      });

      db.run("COMMIT", (err) => {
        stmt.finalize();
        if (err) reject(err);
        else {
          console.log(`[DB] Saved/Updated ${detailsArray.length} company details.`);
          resolve();
        }
      });
    });
  });
}

function getAllSecurityIds() {
  return new Promise((resolve, reject) => {
    db.all("SELECT DISTINCT security_id, symbol FROM stock_prices WHERE security_id > 0", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}



// API Helpers

function searchStocks(query) {
  return new Promise((resolve, reject) => {
    const pattern = `%${query}%`;
    // Search in both tables, prioritize company_details?
    // Let's search stock_prices for active trading ones.
    db.all(
      `SELECT DISTINCT symbol, security_name, security_id FROM stock_prices 
             WHERE symbol LIKE ? OR security_name LIKE ? 
             ORDER BY symbol LIMIT 20`,
      [pattern, pattern],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getScriptDetails(symbol) {
  return new Promise((resolve, reject) => {
    // Fetch details and latest price
    const sql = `
            SELECT 
                cd.*, 
                sp.open_price, sp.high_price, sp.low_price, sp.close_price, 
                sp.previous_close, sp.last_traded_price, sp.business_date
            FROM company_details cd
            LEFT JOIN stock_prices sp ON cd.symbol = sp.symbol
            WHERE cd.symbol = ?
        `;
    // Fallback: If company_details empty, try just stock_prices

    db.get(sql, [symbol], (err, row) => {
      if (err) reject(err);
      else if (row) {
        resolve(row);
      } else {
        // Try fetching just price if no details yet
        db.get("SELECT * FROM stock_prices WHERE symbol = ?", [symbol], (err, priceRow) => {
          if (err) reject(err);
          else resolve(priceRow);
        });
      }
    });
  });
}

function getLatestPrices(symbols) {
  return new Promise((resolve, reject) => {
    if (!symbols || symbols.length === 0) return resolve([]);

    const placeholders = symbols.map(() => '?').join(',');
    const sql = `SELECT * FROM stock_prices WHERE symbol IN (${placeholders})`;

    db.all(sql, symbols, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db, savePrices, saveCompanyDetails, getAllSecurityIds,
  searchStocks, getScriptDetails, getLatestPrices
};
