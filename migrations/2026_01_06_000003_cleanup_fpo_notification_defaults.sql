-- Remove 'fpo' from default notification types as FPOs use their own share_type (ordinary/local etc)
-- and users should get notified based on those existing preferences.

-- 1. Update existing users to remove 'fpo' if it was just added
UPDATE users 
SET ipo_notification_types = JSON_REMOVE(
  ipo_notification_types, 
  JSON_UNQUOTE(JSON_SEARCH(ipo_notification_types, 'one', 'fpo'))
)
WHERE JSON_CONTAINS(ipo_notification_types, JSON_QUOTE('fpo'));

-- 2. Update column default for new users (remove 'fpo')
ALTER TABLE users 
MODIFY COLUMN ipo_notification_types JSON DEFAULT (JSON_ARRAY('ordinary'));
