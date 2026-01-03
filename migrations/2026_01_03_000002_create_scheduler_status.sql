CREATE TABLE IF NOT EXISTS scheduler_status (
    job_name VARCHAR(50) PRIMARY KEY,
    last_run TIMESTAMP NULL,
    last_success TIMESTAMP NULL,
    success_count INT DEFAULT 0,
    fail_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'IDLE', -- 'RUNNING', 'SUCCESS', 'FAILED', 'IDLE'
    message TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
