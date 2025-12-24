-- Add IPO notification type preferences to users table
-- This allows users to customize which types of IPOs they want to receive notifications for
-- Default: only 'ordinary' type enabled

-- Add JSON column to store IPO notification type preferences
ALTER TABLE users ADD COLUMN ipo_notification_types JSON DEFAULT NULL;

-- Set default value for existing users (only ordinary enabled)
UPDATE users 
SET ipo_notification_types = JSON_ARRAY('ordinary')
WHERE ipo_notification_types IS NULL;

-- Set default for the column
ALTER TABLE users 
MODIFY COLUMN ipo_notification_types JSON DEFAULT (JSON_ARRAY('ordinary'));
