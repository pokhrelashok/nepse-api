-- Add daily counts to scheduler_status table
ALTER TABLE scheduler_status 
ADD COLUMN today_success_count INT DEFAULT 0 AFTER fail_count,
ADD COLUMN today_fail_count INT DEFAULT 0 AFTER today_success_count,
ADD COLUMN stats_date DATE NULL AFTER today_fail_count;
