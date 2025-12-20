-- Migration: Update dividend tables for better tracking
-- 1. Update announced_dividends table
ALTER TABLE announced_dividends 
ADD COLUMN published_date DATE AFTER book_close_date,
ADD COLUMN fiscal_year_bs VARCHAR(50) AFTER fiscal_year,
ADD COLUMN book_close_date_bs VARCHAR(50) AFTER book_close_date;

-- 2. Rename book_close_date to published_date in dividends table
-- Note: User mentioned this is actually published_date
ALTER TABLE dividends 
CHANGE COLUMN book_close_date published_date DATE;

-- Update unique key for announced_dividends if necessary
-- The existing one is UNIQUE KEY unique_dividend (symbol, fiscal_year, book_close_date)
-- We'll keep it as is for now, but we'll populate published_date from the other table.
