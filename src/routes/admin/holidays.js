const express = require('express');
const router = express.Router();
const HolidayService = require('../../services/holiday-service');
const { formatResponse, formatError } = require('../../utils/formatter');
const { authMiddleware } = require('../../middleware/auth');

/**
 * GET /admin/holidays
 * Get all holidays
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const holidays = await HolidayService.getAllHolidays();
    res.json(formatResponse(holidays));
  } catch (error) {
    res.status(500).json(formatError(error.message));
  }
});

/**
 * POST /admin/holidays/sync
 * Manually trigger holiday sync
 */
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const result = await HolidayService.syncHolidays();
    res.json(formatResponse(result, 'Holidays synced successfully'));
  } catch (error) {
    res.status(500).json(formatError(error.message));
  }
});

/**
 * POST /admin/holidays
 * Add or update a holiday
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { holiday_date, description, is_active } = req.body;

    if (!holiday_date || !description) {
      return res.status(400).json(formatError('Date and description are required'));
    }

    await HolidayService.saveHoliday({
      holiday_date,
      description,
      is_active: is_active !== undefined ? is_active : true
    });

    res.json(formatResponse(null, 'Holiday saved successfully'));
  } catch (error) {
    res.status(500).json(formatError(error.message));
  }
});

/**
 * DELETE /admin/holidays/:date
 * Delete a holiday
 */
router.delete('/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    await HolidayService.deleteHoliday(date);
    res.json(formatResponse(null, 'Holiday deleted successfully'));
  } catch (error) {
    res.status(500).json(formatError(error.message));
  }
});

module.exports = router;
