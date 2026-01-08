const { formatResponse, formatError } = require('../utils/formatter');
const logger = require('../utils/logger');

// Scheduler instance is passed from server.js or better yet, we might need a way to access the singleton.
// In the original server.js, scheduler was instantiated there. 
// A better approach is to have a singleton scheduler instance exported from scheduler.js or a separate module.
// However, to keep it simple for now, we'll assume the scheduler instance is passed or accessible.
// Actually, looking at the pattern, we might need to modify how Scheduler is instantiated.
// Let's modify src/scheduler.js to export a singleton or create a singleton wrapper.
// But for now, let's keep the logic here and import the scheduler instance in the route handler? 
// No, express routes expect (req, res). 
// We can attach scheduler to req in middleware or export a function that returns the router with scheduler injected.
// Or we can just export the handlers and let server.js bind them? 
// But server.js is being simplified.
// Let's create a singleton provider for scheduler.

// But wait, server.js initializes: const scheduler = new Scheduler();
// If we move that to a separate file, we can require it.

// Let's assume we'll have a `src/services/schedulerService.js` or just `src/schedulerInstance.js`?
// Or we can just import the class and instantiate it in the controller if it's singleton?
// The Scheduler class in `src/scheduler.js` is a class, not a singleton instance.
// Let's create a singleton instance in `src/services/schedulerService.js` (or just use a global for now which is what it was effectively in server.js).
// Actually, let's make `server.js` export the scheduler instance? No, circular dependency potential.
// Best way: Create `src/lib/scheduler.js` which exports a singleton.
// But current `src/scheduler.js` exports the class.
// Let's assume for this refactor we will modify `server.js` to instantiate it and then we pass it to the routes?
// Standard Express pattern: pass dependencies or use a container.
// Simplest refactor: `const scheduler = require('../scheduler-instance');`
// I will create `src/scheduler-instance.js` which exports a singleton.

const scheduler = require('../scheduler-instance');

exports.startScheduler = async (req, res) => {
  try {
    if (scheduler.isSchedulerRunning()) {
      return res.status(400).json(formatError('Scheduler is already running', 400));
    }
    await scheduler.startPriceUpdateSchedule();
    res.json(formatResponse({ message: 'Scheduler started successfully' }));
  } catch (error) {
    console.error('Failed to start scheduler:', error);
    res.status(500).json(formatError('Failed to start scheduler'));
  }
};

exports.stopScheduler = async (req, res) => {
  try {
    await scheduler.stopAllSchedules();
    res.json(formatResponse({ message: 'Scheduler stopped successfully' }));
  } catch (error) {
    console.error('Failed to stop scheduler:', error);
    res.status(500).json(formatError('Failed to stop scheduler'));
  }
};

exports.getSchedulerStatus = (req, res) => {
  try {
    const health = scheduler.getHealth();
    res.json(formatResponse(health));
  } catch (error) {
    logger.error('Failed to get scheduler status:', error);
    res.status(500).json(formatError('Failed to get scheduler status'));
  }
};
