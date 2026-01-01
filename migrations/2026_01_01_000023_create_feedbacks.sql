-- Migration: Create feedbacks table
-- Date: 2026-01-01
-- Description: Create feedbacks table for user feedback with attachments support

CREATE TABLE IF NOT EXISTS feedbacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('pending', 'in_review', 'resolved', 'closed') DEFAULT 'pending',
    attachments JSON DEFAULT NULL, -- Store array of attachment URLs
    user_email VARCHAR(255) DEFAULT NULL,
    user_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
