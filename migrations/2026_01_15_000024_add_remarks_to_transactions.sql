-- Add nullable remarks field to transactions

ALTER TABLE transactions
  ADD COLUMN remarks VARCHAR(255) NULL AFTER date;
