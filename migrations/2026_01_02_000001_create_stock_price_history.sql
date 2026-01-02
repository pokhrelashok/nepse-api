-- Migration to update stock_prices table for historical data support
-- This removes the unique constraint on symbol and adds a composite unique key
-- Also adds total_trades column from API

-- Drop the unique constraint on symbol
ALTER TABLE stock_prices DROP INDEX unique_symbol;

-- Add total_trades column if it doesn't exist
ALTER TABLE stock_prices 
ADD COLUMN IF NOT EXISTS total_trades INT NULL AFTER close_price;

-- Add composite unique key on (security_id, business_date)
ALTER TABLE stock_prices 
ADD UNIQUE KEY unique_security_date (security_id, business_date);

-- Add index on business_date for efficient queries
ALTER TABLE stock_prices 
ADD INDEX IF NOT EXISTS idx_business_date (business_date);
