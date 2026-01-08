-- Add financial metrics columns to company_details table
-- These are calculated fields based on price, financials, and dividends

ALTER TABLE company_details
ADD COLUMN pe_ratio DECIMAL(10, 4) DEFAULT NULL COMMENT 'Price to Earnings Ratio',
ADD COLUMN pb_ratio DECIMAL(10, 4) DEFAULT NULL COMMENT 'Price to Book Ratio',
ADD COLUMN dividend_yield DECIMAL(10, 4) DEFAULT NULL COMMENT 'Dividend Yield %',
ADD COLUMN metrics_updated_at TIMESTAMP NULL COMMENT 'When metrics were last calculated',
ADD INDEX idx_pe_ratio (pe_ratio),
ADD INDEX idx_pb_ratio (pb_ratio),
ADD INDEX idx_dividend_yield (dividend_yield);
