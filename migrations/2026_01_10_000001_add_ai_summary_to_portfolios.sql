-- Add AI summary fields to portfolios table
-- This stores the aggregated AI analysis for the entire portfolio

ALTER TABLE portfolios 
ADD COLUMN ai_summary TEXT DEFAULT NULL,
ADD COLUMN ai_summary_updated_at DATETIME DEFAULT NULL;
