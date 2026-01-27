-- Migration: Add Mutual Fund NAV table and maturity fields to company_details
-- Created: 2026-01-21

-- Add maturity fields to company_details
-- Add maturity fields to company_details
-- ALTER TABLE company_details 
-- ADD COLUMN maturity_date VARCHAR(50) AFTER listing_date,
-- ADD COLUMN maturity_period VARCHAR(100) AFTER maturity_date;

-- Create mutual_fund_navs table
CREATE TABLE IF NOT EXISTS mutual_fund_navs (
    security_id INT PRIMARY KEY,
    weekly_nav DECIMAL(15, 2),
    weekly_nav_date DATE,
    monthly_nav DECIMAL(15, 2),
    monthly_nav_date VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (security_id) REFERENCES company_details(security_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
