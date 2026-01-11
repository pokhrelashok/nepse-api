const { pool } = require('../database/database');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { DateTime } = require('luxon');

/**
 * Holiday Service - Handles market holiday checking and synchronization
 */
class HolidayService {
  /**
   * Checks if a given date is a holiday
   * @param {string} date ISO date string (YYYY-MM-DD)
   * @returns {Promise<boolean>}
   */
  async isHoliday(date = null) {
    const targetDate = date || DateTime.now().setZone('Asia/Kathmandu').toISODate();

    // 1. Check Redis Cache
    try {
      const cached = await redis.get(`holiday:${targetDate}`);
      if (cached !== null) {
        return cached === 'true';
      }
    } catch (error) {
      logger.error('Redis error in HolidayService.isHoliday:', error);
    }

    // 2. Check Database
    try {
      const [rows] = await pool.execute(
        'SELECT is_active FROM holidays WHERE holiday_date = ?',
        [targetDate]
      );

      const isHoliday = rows.length > 0 && rows[0].is_active === 1;

      // Cache the result (expire at end of today in Nepal time)
      const nowNepal = DateTime.now().setZone('Asia/Kathmandu');
      const endOfToday = nowNepal.endOf('day');
      const ttlSeconds = Math.floor(endOfToday.diff(nowNepal, 'seconds').seconds);

      if (ttlSeconds > 0) {
        await redis.set(`holiday:${targetDate}`, isHoliday ? 'true' : 'false', 'EX', ttlSeconds);
      }

      return isHoliday;
    } catch (error) {
      logger.error('Database error in HolidayService.isHoliday:', error);
      return false; // Default to not a holiday on error to avoid blocking if DB is down
    }
  }

  /**
   * Syncs holidays from ShareHub API
   * @returns {Promise<{success: boolean, count: number}>}
   */
  async syncHolidays() {
    logger.info('🔄 Syncing market holidays from ShareHub...');

    try {
      const response = await fetch('https://sharehubnepal.com/data/api/v1/holiday', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://sharehubnepal.com/nepse/holidays'
        }
      });

      if (!response.ok) {
        throw new Error(`ShareHub API returned ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data || !data.data.content) {
        throw new Error('Invalid response from ShareHub API');
      }

      const holidays = data.data.content;
      let syncCount = 0;

      for (const h of holidays) {
        // Parse date from "2026-03-27T00:00:00"
        const holidayDate = h.date.split('T')[0];
        const description = h.description;
        const isActive = h.isActive ? 1 : 0;

        await pool.execute(
          `INSERT INTO holidays (holiday_date, description, is_active) 
           VALUES (?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
           description = VALUES(description), 
           is_active = VALUES(is_active)`,
          [holidayDate, description, isActive]
        );
        syncCount++;
      }

      logger.info(`✅ Successfully synced ${syncCount} holidays from ShareHub`);

      // Clear all holiday cache
      const keys = await redis.keys('holiday:*');
      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();
      }

      return { success: true, count: syncCount };
    } catch (error) {
      logger.error('❌ Holiday sync failed:', error);
      throw error;
    }
  }

  /**
   * Gets all holidays from database
   */
  async getAllHolidays() {
    const [rows] = await pool.execute('SELECT * FROM holidays ORDER BY holiday_date DESC');
    return rows;
  }

  /**
   * Adds or updates a holiday manually
   * @param {Object} holiday { holiday_date, description, is_active }
   */
  async saveHoliday(holiday) {
    const { holiday_date, description, is_active } = holiday;
    await pool.execute(
      `INSERT INTO holidays (holiday_date, description, is_active) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       description = VALUES(description), 
       is_active = VALUES(is_active)`,
      [holiday_date, description, is_active ? 1 : 0]
    );

    // Clear cache for this specific date
    await redis.del(`holiday:${holiday_date}`);
    return { success: true };
  }

  /**
   * Deletes a holiday
   * @param {string} date YYYY-MM-DD
   */
  async deleteHoliday(date) {
    await pool.execute('DELETE FROM holidays WHERE holiday_date = ?', [date]);
    await redis.del(`holiday:${date}`);
    return { success: true };
  }
}

module.exports = new HolidayService();
