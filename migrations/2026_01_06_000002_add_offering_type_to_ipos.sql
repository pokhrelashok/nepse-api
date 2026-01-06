-- 1. Add offering_type to ipos table
ALTER TABLE ipos ADD COLUMN offering_type ENUM('ipo', 'fpo') DEFAULT 'ipo' AFTER share_type;