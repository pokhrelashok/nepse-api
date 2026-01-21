#!/usr/bin/env node

const { pool } = require('../src/database/database');

async function checkSQL() {
  try {
    const sql = `
      INSERT INTO company_details (
        security_id, symbol, company_name, nepali_company_name, sector_name, nepali_sector_name,
        instrument_type, issue_manager, share_registrar,
        listing_date, total_listed_shares, paid_up_capital,
        total_paid_up_value, email, website, status, permitted_to_trade,
        promoter_shares, public_shares, market_capitalization,
        pe_ratio, pb_ratio, dividend_yield, eps,
        maturity_date, maturity_period,
        logo_url, is_logo_placeholder, last_traded_price,
        open_price, close_price, high_price, low_price, previous_close,
        fifty_two_week_high, fifty_two_week_low, total_traded_quantity,
        total_trades, average_traded_price, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // Count columns
    const columnsMatch = sql.match(/INSERT INTO company_details \(([\s\S]+?)\) VALUES/);
    if (columnsMatch) {
      const columns = columnsMatch[1].split(',').map(c => c.trim()).filter(c => c);
      console.log('Number of columns:', columns.length);
      console.log('Columns:', columns.join(', '));
    }

    // Count placeholders
    const valuesMatch = sql.match(/VALUES \((.+?)\)/);
    if (valuesMatch) {
      const placeholders = valuesMatch[1].split(',').map(p => p.trim()).filter(p => p);
      console.log('\nNumber of placeholders:', placeholders.length);
      console.log('Placeholders:', placeholders.join(', '));

      const questionMarks = placeholders.filter(p => p === '?');
      console.log('\nNumber of ? marks:', questionMarks.length);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSQL();
