-- Add EPS (Earnings Per Share) column to company_details table
-- This is a calculated field extracted from the latest financial data

-- Add EPS column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'company_details';
SET @columnname = 'eps';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE company_details ADD COLUMN eps DECIMAL(10, 4) DEFAULT NULL COMMENT ''Earnings Per Share'', ADD INDEX idx_eps (eps)'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
