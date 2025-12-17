CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  portfolio_id VARCHAR(36) NOT NULL,
  stock_symbol VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL COMMENT 'IPO, FPO, AUCTION, RIGHTS, SECONDARY_BUY, SECONDARY_SELL, BONUS, DIVIDEND',
  quantity DOUBLE NOT NULL,
  price DOUBLE NOT NULL,
  transaction_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE,
  INDEX idx_transactions_portfolio_date (portfolio_id, transaction_date),
  INDEX idx_transactions_symbol (stock_symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
