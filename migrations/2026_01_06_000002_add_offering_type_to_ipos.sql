-- Add offering_type to ipos table and update user notification defaults

-- 1. Add offering_type to ipos table
ALTER TABLE ipos ADD COLUMN offering_type ENUM('ipo', 'fpo') DEFAULT 'ipo' AFTER share_type;

-- 2. Update existing status logic to be more generic if needed (optional, keeping current status for now)

-- 3. Update users table defaults for ipo_notification_types
-- Existing users: add 'fpo' and 'local' to their notification types
UPDATE users 
SET ipo_notification_types = JSON_ARRAY('ordinary', 'fpo')
WHERE ipo_notification_types IS NOT NULL;

-- Update Column default for new users
ALTER TABLE users 
MODIFY COLUMN ipo_notification_types JSON DEFAULT (JSON_ARRAY('ordinary', 'fpo'));
