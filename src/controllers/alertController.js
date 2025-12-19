const queries = require('../database/queries');
const logger = require('../utils/logger');
const { formatResponse, formatError } = require('../utils/formatter');

const createAlert = async (req, res) => {
  const { symbol, price, condition } = req.body;
  const userId = req.currentUser.id;

  if (!symbol || !price || !condition) {
    return res.status(400).json(formatError('Symbol, price, and condition are required'));
  }

  try {
    const alertId = await queries.createPriceAlert(userId, symbol, price, condition);
    res.status(201).json(formatResponse({ id: alertId, symbol, price, condition }, 'Alert created successfully'));
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
  const { price, condition, is_active } = req.body;

  try {
    const success = await queries.updatePriceAlert(alertId, userId, { price, condition, is_active });
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
