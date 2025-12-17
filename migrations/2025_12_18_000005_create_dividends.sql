CREATE TABLE IF NOT EXISTS dividends (
  id INT AUTO_INCREMENT PRIMARY KEY,
  security_id INT NOT NULL,
  fiscal_year VARCHAR(20),
  bonus_share DECIMAL(10, 2),
  cash_dividend DECIMAL(10, 2),
  total_dividend DECIMAL(10, 2),
  book_close_date VARCHAR(20),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dividend (security_id, fiscal_year),
  INDEX idx_dividends_security (security_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
