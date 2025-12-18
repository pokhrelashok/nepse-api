-- Migration: Rename transaction fields
-- Renaming transaction_type to type and transaction_date to date in the transactions table

ALTER TABLE transactions CHANGE COLUMN transaction_type type VARCHAR(50) NOT NULL COMMENT 'IPO, FPO, AUCTION, RIGHTS, SECONDARY_BUY, SECONDARY_SELL, BONUS, DIVIDEND';
ALTER TABLE transactions CHANGE COLUMN transaction_date date DATE;

-- Update indexes if necessary (MySQL usually handles this but good to be explicit for clarity)
-- The original table had:
-- INDEX idx_transactions_portfolio_date (portfolio_id, transaction_date)
-- This index will automatically use the renamed column.
