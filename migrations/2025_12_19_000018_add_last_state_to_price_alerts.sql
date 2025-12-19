-- Add last_state column for crossing logic and EQUAL condition support
ALTER TABLE price_alerts 
ADD COLUMN last_state ENUM('MET', 'NOT_MET') DEFAULT 'NOT_MET' AFTER alert_condition;

-- Add EQUAL to alert_condition ENUM if it doesn't exist
ALTER TABLE price_alerts 
MODIFY COLUMN alert_condition ENUM('ABOVE', 'BELOW', 'EQUAL') NOT NULL;
