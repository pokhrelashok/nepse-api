-- Add is_primary column to user_boids if it doesn't exist
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_boids' AND COLUMN_NAME = 'is_primary') > 0,
    "SELECT 'Column is_primary already exists'",
    "ALTER TABLE user_boids ADD COLUMN is_primary BOOLEAN DEFAULT FALSE AFTER boid"
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure name is NOT NULL
ALTER TABLE user_boids MODIFY COLUMN name VARCHAR(255) NOT NULL;
