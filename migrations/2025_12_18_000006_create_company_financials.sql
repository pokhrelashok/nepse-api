CREATE TABLE IF NOT EXISTS company_financials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  security_id INT NOT NULL,
  fiscal_year VARCHAR(20),
  quarter VARCHAR(50),
  paid_up_capital DECIMAL(25, 2),
  net_profit DECIMAL(25, 2),
  earnings_per_share DECIMAL(20, 2),
  net_worth_per_share DECIMAL(20, 2),
  price_earnings_ratio DECIMAL(20, 4),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_financial (security_id, fiscal_year, quarter),
  INDEX idx_financials_security (security_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
