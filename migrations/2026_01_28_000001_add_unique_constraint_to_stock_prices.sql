-- Add unique constraint to stock_prices to prevent duplicates
-- Add index on business_date to speed up queries and cleanup
CREATE INDEX IF NOT EXISTS idx_stock_prices_date ON stock_prices (business_date);

-- Add the unique constraint on (symbol, business_date)
CREATE UNIQUE INDEX IF NOT EXISTS unique_symbol_date ON stock_prices (symbol, business_date);


