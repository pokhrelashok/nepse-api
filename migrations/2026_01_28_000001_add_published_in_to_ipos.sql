-- Add published_in column to track which provider has published IPO results
ALTER TABLE ipos 
ADD COLUMN published_in VARCHAR(100) DEFAULT NULL AFTER status;

-- Add index for faster queries
ALTER TABLE ipos 
ADD INDEX idx_published_in (published_in);
