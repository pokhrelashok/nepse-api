/**
 * Utility functions for normalizing and formatting IPO share types
 */

/**
 * Normalize share type to lowercase_underscore format for database storage
 * @param {string} shareType - Raw share type from API (e.g., "Migrant Workers", "ordinary", "Local")
 * @returns {string} Normalized share type (e.g., "migrant_workers", "ordinary", "local")
 */
function normalizeShareType(shareType) {
  if (!shareType) return null;

  // Trim and convert to lowercase
  // Replace spaces with underscores
  const normalized = shareType.trim().toLowerCase().replace(/\s+/g, '_');

  // Standardize to match frontend/user preference keys
  if (normalized === 'ordinary_shares' || normalized === 'ordinary_share') return 'ordinary';
  if (normalized === 'project_affected_locals' || normalized === 'locals') return 'local';
  if (normalized === 'foreign_employment') return 'migrant_workers';

  return normalized;
}

/**
 * Format share type for display (Title Case)
 * @param {string} shareType - Normalized share type from database (e.g., "migrant_workers", "ordinary")
 * @returns {string} Formatted share type (e.g., "Migrant Workers", "Ordinary")
 */
function formatShareType(shareType) {
  if (!shareType) return '';

  // Replace underscores with spaces and convert to Title Case
  return shareType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  normalizeShareType,
  formatShareType
};
