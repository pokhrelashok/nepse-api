-- Add AI summary field to company_details table
-- This field stores AI-generated performance summaries for stocks

ALTER TABLE company_details 
ADD COLUMN ai_summary TEXT DEFAULT NULL AFTER updated_at;
