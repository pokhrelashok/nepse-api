-- Add Nepali name columns to company_details table
ALTER TABLE company_details
    ADD COLUMN nepali_company_name VARCHAR(255) AFTER company_name,
    ADD COLUMN nepali_sector_name VARCHAR(100) AFTER sector_name;

-- Add Nepali name columns to ipos table
ALTER TABLE ipos
    ADD COLUMN nepali_company_name VARCHAR(255) AFTER company_name,
    ADD COLUMN nepali_sector_name VARCHAR(100) AFTER sector_name;

-- Add Nepali company name column to announced_dividends table
ALTER TABLE announced_dividends
    ADD COLUMN nepali_company_name VARCHAR(255) AFTER company_name;
