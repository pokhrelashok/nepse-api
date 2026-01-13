-- Add portfolio_id to user_goals table
-- NULL portfolio_id means goal applies to all portfolios

ALTER TABLE user_goals 
ADD COLUMN portfolio_id VARCHAR(36) NULL AFTER user_id,
ADD FOREIGN KEY fk_goals_portfolio (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE;

-- Add index for efficient queries
ALTER TABLE user_goals 
ADD INDEX idx_portfolio_status (portfolio_id, status);

-- Update existing index to include portfolio_id
ALTER TABLE user_goals 
DROP INDEX idx_user_type_status,
ADD INDEX idx_user_portfolio_type_status (user_id, portfolio_id, type, status);
