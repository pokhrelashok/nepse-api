CREATE TABLE IF NOT EXISTS market_index (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trading_date VARCHAR(20) NOT NULL,
  market_status_date VARCHAR(50),
  market_status_time VARCHAR(50),
  nepse_index DECIMAL(15, 4),
  index_change DECIMAL(15, 4),
  index_percentage_change DECIMAL(10, 4),
  total_turnover DECIMAL(25, 2),
  total_traded_shares BIGINT,
  advanced INT,
  declined INT,
  unchanged INT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_trading_date (trading_date),
  INDEX idx_market_index_date (trading_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
