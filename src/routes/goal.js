const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const goalController = require('../controllers/goal-controller');

/**
 * @route GET /api/goals
 * @desc Get all active goals with progress
 * @access Private
 */
router.get('/', verifyToken, goalController.getGoals);

/**
 * @route POST /api/goals
 * @desc Create a new goal
 * @access Private
 */
router.post('/', verifyToken, goalController.createNewGoal);

/**
 * @route PUT /api/goals/:id
 * @desc Update a goal
 * @access Private
 */
router.put('/:id', verifyToken, goalController.updateGoalDetails);

/**
 * @route DELETE /api/goals/:id
 * @desc Delete a goal
 * @access Private
 */
router.delete('/:id', verifyToken, goalController.removeGoal);

module.exports = router;
