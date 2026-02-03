/**
 * Date utility functions for Nepali time
 */

const getNepaliStartOfDay = () => {
  // Since the system is configured to Nepal Time (UTC+5:45),
  // we can simply use the local start of day.
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

module.exports = {
  getNepaliStartOfDay
};
