-- Migration to extend price_alerts table for WACC-based alerts
ALTER TABLE price_alerts 
ADD COLUMN alert_type ENUM('PRICE', 'WACC_PERCENTAGE') DEFAULT 'PRICE' AFTER symbol,
ADD COLUMN target_percentage DECIMAL(10, 2) NULL AFTER alert_type,
MODIFY COLUMN target_price DECIMAL(10, 2) NULL;
