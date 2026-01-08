/**
 * Format a date to a clean, readable string like "Feb 27, 2025"
 */
function formatDate(date) {
  if (!date) return 'TBD';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format share type for display
 * Delegates to utility function for consistency
 */
function formatShareType(shareType) {
  const { formatShareType: formatUtil } = require('../../utils/share-type-utils');
  return formatUtil(shareType);
}

module.exports = {
  formatDate,
  formatShareType
};
