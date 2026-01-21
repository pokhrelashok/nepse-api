#!/usr/bin/env node

const columns = [
  'security_id', 'symbol', 'company_name', 'nepali_company_name', 'sector_name', 'nepali_sector_name',
  'instrument_type', 'issue_manager', 'share_registrar',
  'listing_date', 'total_listed_shares', 'paid_up_capital',
  'total_paid_up_value', 'email', 'website', 'status', 'permitted_to_trade',
  'promoter_shares', 'public_shares', 'market_capitalization',
  'pe_ratio', 'pb_ratio', 'dividend_yield', 'eps',
  'maturity_date', 'maturity_period',
  'logo_url', 'is_logo_placeholder', 'last_traded_price',
  'open_price', 'close_price', 'high_price', 'low_price', 'previous_close',
  'fifty_two_week_high', 'fifty_two_week_low', 'total_traded_quantity',
  'total_trades', 'average_traded_price', 'updated_at'
];

const values = [
  'd.security_id', 'd.symbol', 'd.company_name', 'd.nepali_company_name', 'd.sector_name', 'd.nepali_sector_name',
  'd.instrument_type', 'd.issue_manager', 'd.share_registrar',
  'd.listing_date', 'd.total_listed_shares', 'd.paid_up_capital',
  'd.total_paid_up_value', 'd.email', 'd.website', 'd.status', 'd.permitted_to_trade',
  'd.promoter_shares', 'd.public_shares', 'd.market_capitalization',
  'peRatio', 'pbRatio', 'dividendYield', 'eps',
  'd.maturity_date', 'd.maturity_period',
  'd.logo_url', 'd.is_logo_placeholder', 'd.last_traded_price',
  'd.open_price',
  '(d.close_price && d.close_price > 0) ? d.close_price : (d.last_traded_price ?? 0)',
  'd.high_price', 'd.low_price', 'd.previous_close',
  'd.fifty_two_week_high', 'd.fifty_two_week_low', 'd.total_traded_quantity',
  'd.total_trades', 'd.average_traded_price'
];

console.log('Columns:', columns.length);
console.log('Values:', values.length);
console.log('\nMissing:', columns.length - values.length);

if (columns.length !== values.length) {
  console.log('\nColumn-Value mapping:');
  for (let i = 0; i < Math.max(columns.length, values.length); i++) {
    const col = columns[i] || '???';
    const val = values[i] || '???';
    const match = col.replace(/_/g, '') === val.replace(/d\.|_/g, '').toLowerCase() || val === '???';
    console.log(`${i + 1}. ${col.padEnd(25)} => ${val} ${match ? '' : '⚠️'}`);
  }
}
