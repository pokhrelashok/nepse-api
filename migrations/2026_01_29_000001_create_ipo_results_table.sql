-- Create ipo_results table to store raw IPO script data from bank websites
CREATE TABLE IF NOT EXISTS ipo_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    company_name VARCHAR(255) NOT NULL, -- Raw company name from bank website
    share_type VARCHAR(50) NOT NULL,    -- Normalized share type
    value VARCHAR(255) NOT NULL,        -- Value used for checking (usually an ID)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_provider_company_share (provider_id, company_name, share_type),
    INDEX idx_provider_id (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
