const queries = require('../database/queries');
const logger = require('../utils/logger');
const { formatResponse, formatError } = require('../utils/formatter');

const createAlert = async (req, res) => {
  const { symbol, price, condition, alert_type, target_percentage } = req.body;
  const userId = req.currentUser.id;

  if (!symbol || !condition) {
    return res.status(400).json(formatError('Symbol and condition are required'));
  }

  if (alert_type === 'WACC_PERCENTAGE' && target_percentage === undefined) {
    return res.status(400).json(formatError('Target percentage is required for WACC alerts'));
  }

  if ((!alert_type || alert_type === 'PRICE') && price === undefined) {
    return res.status(400).json(formatError('Price is required for price alerts'));
  }

  try {
    const alertId = await queries.createPriceAlert(userId, symbol, price, condition, alert_type || 'PRICE', target_percentage);
    res.status(201).json(formatResponse({ id: alertId, symbol, price, condition, alert_type, target_percentage }, 'Alert created successfully'));
  } catch (error) {
    logger.error('Create Alert Error:', error);
    res.status(500).json(formatError('Failed to create alert'));
  }
};

const getAlerts = async (req, res) => {
  const userId = req.currentUser.id;

  try {
    const alerts = await queries.getUserPriceAlerts(userId);
    res.json(formatResponse(alerts));
  } catch (error) {
    logger.error('Get Alerts Error:', error);
    res.status(500).json(formatError('Failed to fetch alerts'));
  }
};

const updateAlert = async (req, res) => {
  const alertId = req.params.id;
  const userId = req.currentUser.id;
  const { price, condition, is_active, alert_type, target_percentage } = req.body;

  try {
    const success = await queries.updatePriceAlert(alertId, userId, { price, condition, is_active, alert_type, target_percentage });
    if (!success) {
      return res.status(404).json(formatError('Alert not found or unauthorized'));
    }
    res.json(formatResponse(null, 'Alert updated successfully'));
  } catch (error) {
    logger.error('Update Alert Error:', error);
    res.status(500).json(formatError('Failed to update alert'));
  }
};

const deleteAlert = async (req, res) => {
  const alertId = req.params.id;
  const userId = req.currentUser.id;

  try {
    const success = await queries.deletePriceAlert(alertId, userId);
    if (!success) {
      return res.status(404).json(formatError('Alert not found or unauthorized'));
    }
    res.json(formatResponse(null, 'Alert deleted successfully'));
  } catch (error) {
    logger.error('Delete Alert Error:', error);
    res.status(500).json(formatError('Failed to delete alert'));
  }
};

module.exports = {
  createAlert,
  getAlerts,
  updateAlert,
  deleteAlert
};
