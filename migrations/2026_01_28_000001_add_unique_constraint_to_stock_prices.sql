-- Add unique constraint to stock_prices to prevent duplicates
-- Add index on business_date to speed up queries and cleanup
CREATE INDEX idx_stock_prices_date ON stock_prices (business_date);

-- Add the unique constraint on (symbol, business_date)
ALTER TABLE stock_prices ADD UNIQUE INDEX unique_symbol_date (symbol, business_date);


