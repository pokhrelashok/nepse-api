-- Migration script to fix column sizes for financial data
-- This addresses "Out of range value" errors for large financial values

USE nepse_db;

-- Alter company_financials table to support larger values
ALTER TABLE company_financials
  MODIFY COLUMN earnings_per_share DECIMAL(20, 2),
  MODIFY COLUMN net_worth_per_share DECIMAL(20, 2),
  MODIFY COLUMN price_earnings_ratio DECIMAL(20, 4);

-- Verify the changes
DESCRIBE company_financials;
