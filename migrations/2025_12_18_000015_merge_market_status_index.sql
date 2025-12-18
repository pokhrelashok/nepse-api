-- Add status columns to market_index
ALTER TABLE market_index ADD COLUMN status VARCHAR(20) DEFAULT 'CLOSED' AFTER trading_date;
ALTER TABLE market_index ADD COLUMN is_open TINYINT(1) DEFAULT 0 AFTER status;

-- Copy latest status to today's index entry if exists (optional, mostly for consistency if running live)
-- We won't complex backfill here, just structure.

-- Drop the old table
DROP TABLE IF EXISTS market_status;
