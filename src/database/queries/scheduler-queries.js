const { pool } = require('../database');
const logger = require('../../utils/logger');

// Helper function to convert ISO datetime to MySQL format
function toMySQLDatetime(isoString) {
  if (!isoString) return null;
  // Convert '2026-01-04T07:25:40.014Z' to '2026-01-04 07:25:40'
  return isoString.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace('Z', '');
}

// Wrapper functions for database operations
async function saveSchedulerStatus(jobName, statusData) {
  const { last_run, last_success, success_count, fail_count, today_success_count, today_fail_count, stats_date, status, message } = statusData;

  // Convert ISO datetime strings to MySQL-compatible format
  const mysqlLastRun = toMySQLDatetime(last_run);
  const mysqlLastSuccess = toMySQLDatetime(last_success);
  const sql = `
    INSERT INTO scheduler_status (job_name, last_run, last_success, success_count, fail_count, today_success_count, today_fail_count, stats_date, status, message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      last_run = COALESCE(VALUES(last_run), last_run),
      last_success = COALESCE(VALUES(last_success), last_success),
      success_count = VALUES(success_count),
      fail_count = VALUES(fail_count),
      today_success_count = VALUES(today_success_count),
      today_fail_count = VALUES(today_fail_count),
      stats_date = VALUES(stats_date),
      status = VALUES(status),
      message = VALUES(message)
  `;
  try {
    const [result] = await pool.execute(sql, [
      jobName, mysqlLastRun, mysqlLastSuccess,
      success_count, fail_count,
      today_success_count || 0, today_fail_count || 0, stats_date || null,
      status, message
    ]);
    return result;
  } catch (error) {
    logger.error(`❌ Error saving scheduler status for ${jobName}:`, error);
    // Don't throw, just log
  }
}


async function getSchedulerStatus() {
  const sql = `
    SELECT 
      job_name,
      last_run,
      last_success,
      success_count,
      fail_count,
      today_success_count,
      today_fail_count,
      stats_date,
      status,
      message
    FROM scheduler_status
  `;
  try {
    const [rows] = await pool.execute(sql);
    return rows;
  } catch (error) {
    logger.error('❌ Error fetching scheduler status:', error);
    return [];
  }
}

module.exports = {
  saveSchedulerStatus,
  getSchedulerStatus
};
