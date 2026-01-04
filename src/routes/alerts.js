const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const alertController = require('../controllers/alertController');

// Apply auth middleware to all alert routes
router.use(verifyToken);

// Routes
router.post('/', alertController.createAlert);
router.get('/', alertController.getAlerts);
router.put('/:id', alertController.updateAlert);
router.delete('/:id', alertController.deleteAlert);

module.exports = router;
