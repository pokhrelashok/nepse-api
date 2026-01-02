-- Create stock_price_history table
CREATE TABLE IF NOT EXISTS stock_price_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  security_id INT,
  symbol VARCHAR(20) NOT NULL,
  business_date DATE NOT NULL,
  high_price DECIMAL(10, 2),
  low_price DECIMAL(10, 2),
  close_price DECIMAL(10, 2),
  total_trades INT,
  total_traded_quantity INT,
  total_traded_value DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_symbol_date (symbol, business_date),
  INDEX idx_date (business_date),
  INDEX idx_security (security_id)
);
