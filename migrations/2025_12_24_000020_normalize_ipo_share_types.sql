-- Migration to normalize share_type values to lowercase_underscore format
-- This ensures consistent data storage and easier querying

-- Update existing data to normalized format
UPDATE ipos 
SET share_type = CASE 
  WHEN LOWER(TRIM(share_type)) = 'migrant workers' THEN 'migrant_workers'
  WHEN LOWER(TRIM(share_type)) = 'ordinary' THEN 'ordinary'
  WHEN LOWER(TRIM(share_type)) = 'local' THEN 'local'
  ELSE LOWER(REPLACE(TRIM(share_type), ' ', '_'))
END
WHERE share_type IS NOT NULL;
