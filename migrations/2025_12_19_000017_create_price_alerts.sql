CREATE TABLE IF NOT EXISTS price_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  target_price DECIMAL(10, 2) NOT NULL,
  alert_condition ENUM('ABOVE', 'BELOW', 'EQUAL') NOT NULL,
  last_state ENUM('MET', 'NOT_MET') DEFAULT 'NOT_MET',
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_alerts_active_symbol (is_active, symbol),
  INDEX idx_alerts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
