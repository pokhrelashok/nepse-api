CREATE TABLE IF NOT EXISTS sips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  nav DECIMAL(10, 2),
  nav_date DATE,
  authorized_fund_size VARCHAR(50),
  net_asset_value VARCHAR(50),
  return_since_inception VARCHAR(20),
  inception_date VARCHAR(50),
  expense_ratio DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
