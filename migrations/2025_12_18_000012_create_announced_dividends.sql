CREATE TABLE IF NOT EXISTS announced_dividends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255),
    bonus_share VARCHAR(50),
    cash_dividend VARCHAR(50),
    total_dividend VARCHAR(50),
    book_close_date DATE,
    fiscal_year VARCHAR(50),
    right_share VARCHAR(50),
    right_book_close_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_dividend (symbol, fiscal_year, book_close_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
