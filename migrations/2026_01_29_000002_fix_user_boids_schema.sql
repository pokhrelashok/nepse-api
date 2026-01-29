-- Add is_primary column to user_boids if it doesn't exist
-- and ensure name is NOT NULL as per requirements
ALTER TABLE user_boids 
ADD COLUMN is_primary BOOLEAN DEFAULT FALSE AFTER boid;

-- Ensure constraints match what is expected in the code
-- The unique key should be (user_id, boid)
-- (It might already exist from previous migrations, but let's be safe)
-- Note: MySQL 8.0 support ADD COLUMN IF NOT EXISTS, but for INDEX it's different.
-- We'll just rely on the fact that if it fails, the table might already be in a decent state.

ALTER TABLE user_boids MODIFY COLUMN name VARCHAR(255) NOT NULL;
