CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS portfolios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  portfolio_id INT NOT NULL,
  company_id INT, -- Can be nullable if custom stock or just tracking by symbol text if company_id not available (though scraping usually gives us IDs) - let's keep it nullable or flexible. Assuming strict linking for now but "symbol" might be useful if ID changes or for unlisted stocks. Let's stick to company_id if we have companies table.
  -- Actually, let's check companies table first. If not exists, we use symbol. 
  -- Existing 'companies' table? I recall "scraper:companies" script.
  -- Let's just use symbol for robust "offline-first" feel or strict FK?
  -- Plan said "company_id (INT, FK -> companies.id)". Let's assume companies table exists.
  -- If not, I should check. But for now, let's include loose columns too just in case.
  -- Actually, strict FK is better for referential integrity.
  stock_symbol VARCHAR(50), -- Fallback or quick lookup
  transaction_type VARCHAR(50) NOT NULL COMMENT 'IPO, FPO, AUCTION, RIGHTS, SECONDARY_BUY, SECONDARY_SELL, BONUS, DIVIDEND',
  quantity DOUBLE NOT NULL,
  price DOUBLE NOT NULL,
  transaction_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
  -- FOREIGN KEY (company_id) REFERENCES companies(id) -- Uncomment if companies table is guaranteed.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  fcm_token VARCHAR(255) UNIQUE NOT NULL,
  device_type VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
