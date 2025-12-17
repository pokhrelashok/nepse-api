ALTER TABLE market_status ADD COLUMN status VARCHAR(20) DEFAULT 'CLOSED' AFTER is_open;
UPDATE market_status SET status = IF(is_open = 1, 'OPEN', 'CLOSED');
