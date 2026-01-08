-- Add AI summary updated at field to company_details table
-- Periodically updated when AI summary is generated on-demand

ALTER TABLE company_details 
ADD COLUMN ai_summary_updated_at DATETIME DEFAULT NULL AFTER ai_summary;
