-- Create user_goals table
CREATE TABLE IF NOT EXISTS user_goals (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('yearly_investment', 'yearly_profit', 'dividend_income', 'portfolio_value', 'stock_accumulation', 'diversification') NOT NULL,
  target_value DECIMAL(15, 2) NOT NULL,
  start_date DATE,
  end_date DATE,
  metadata JSON,
  status ENUM('active', 'completed', 'failed', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type_status (user_id, type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
